import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  captureStateCapsule,
  inspectStateCapsule,
  restoreStateCapsule,
  storeStateCapsule,
  verifyStateCapsule
} from "../tools/state-capsule.js";
import { decodePiTopology, encodePiTopology, restorePiTopologyNode } from "../tools/pi-topology-compression.js";

function clone(value) {
  return value === undefined ? null : JSON.parse(JSON.stringify(value));
}

function safeFileName(value) {
  return encodeURIComponent(String(value)).replace(/%/g, "_");
}

function defaultStateRoot() {
  if (process.env.RUNTIME_STATE_ROOT) return path.resolve(process.env.RUNTIME_STATE_ROOT);
  if (process.platform === "win32") {
    return path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local"), "PaimonCognitiveRuntime");
  }
  return path.join(process.env.XDG_STATE_HOME || path.join(os.homedir(), ".local", "state"), "paimon-cognitive-runtime");
}

export function resolveRuntimeStateRoot(stateRoot) {
  return path.resolve(stateRoot || defaultStateRoot());
}

function topologyPath(root, taskId) {
  return path.join(root, "topology", `${safeFileName(taskId)}.json`);
}

async function writeJson(file, value) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.tmp`;
  await fs.writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await fs.rename(temporary, file);
}

async function ensureStateRoot(root) {
  await Promise.all(["capsules", "topology", "metadata"].map((name) => fs.mkdir(path.join(root, name), { recursive: true })));
}

function asCapsule(value, defaults = {}) {
  if (!value || typeof value !== "object") throw new Error("Runtime tasks and dependencies must be JSON-compatible objects.");
  if (!value.id) throw new Error("Runtime tasks and dependencies require an id.");
  const relations = Array.isArray(value.relations) ? clone(value.relations) : [];
  return captureStateCapsule({
    ...defaults,
    ...clone(value),
    relations,
    source: value.source || defaults.source || { kind: "runtime-caller" },
    restoreRecipe: value.restoreRecipe || defaults.restoreRecipe || { kind: "manual-resume-recipe", executesAutomatically: false }
  });
}

function capsuleNodeRefs(payload) {
  const rootToken = payload?.layers?.root;
  if (!rootToken || !Object.hasOwn(rootToken, "r")) throw new Error("Runtime topology has no root node.");
  const root = payload.layers.topology[rootToken.r];
  const listToken = root?.entries?.find(([keyIndex]) => payload.layers.stringPool[keyIndex] === "capsules")?.[1];
  if (!listToken || !Object.hasOwn(listToken, "r")) throw new Error("Runtime topology has no capsule list.");
  const list = payload.layers.topology[listToken.r];
  if (list?.kind !== "array") throw new Error("Runtime topology capsule list is invalid.");
  return list.values.filter((token) => token && Object.hasOwn(token, "r")).map((token) => token.r);
}

function capsuleFromTopology(payload, id) {
  for (const nodeIndex of capsuleNodeRefs(payload)) {
    const candidate = restorePiTopologyNode(payload, nodeIndex);
    if (candidate.id === id) return candidate;
  }
  throw new Error(`Capsule ${id} is not present in this runtime task graph.`);
}

export function createCognitiveRuntime(options = {}) {
  const stateRoot = resolveRuntimeStateRoot(options.stateRoot);

  return {
    stateRoot,

    async suspend(input = {}) {
      const taskInput = input.task;
      const dependencyInputs = Array.isArray(input.dependencies) ? input.dependencies : [];
      const dependencyCapsules = dependencyInputs.map((dependency) => asCapsule(dependency, { type: "runtime-dependency" }));
      const dependencyIds = dependencyCapsules.map((dependency) => dependency.id);
      const task = asCapsule({
        ...taskInput,
        dependencies: Array.from(new Set([...(Array.isArray(taskInput?.dependencies) ? taskInput.dependencies : []), ...dependencyIds])),
        relations: [
          ...(Array.isArray(taskInput?.relations) ? taskInput.relations : []),
          ...dependencyIds.filter((id) => !(taskInput?.relations || []).some((relation) => relation?.targetId === id)).map((id) => ({ type: "depends-on", targetId: id }))
        ]
      }, { type: "paused-runtime-task" });
      const missingDependencies = task.dependencies.filter((id) => !dependencyIds.includes(id));
      if (missingDependencies.length) throw new Error(`Runtime suspend is missing dependency state for: ${missingDependencies.join(", ")}.`);

      await ensureStateRoot(stateRoot);
      await Promise.all([task, ...dependencyCapsules].map((capsule) => storeStateCapsule(stateRoot, capsule)));
      const graph = encodePiTopology({
        schema: "cognitive-runtime-task-graph-v0",
        taskId: task.id,
        capsules: [task, ...dependencyCapsules]
      });
      const graphFile = topologyPath(stateRoot, task.id);
      await writeJson(graphFile, graph);
      return {
        status: "paused",
        taskId: task.id,
        capsuleId: task.id,
        topologyPath: graphFile,
        dependencies: clone(task.dependencies),
        nextStep: task.state?.nextStep || task.context?.nextStep || null,
        integrity: verifyStateCapsule(task),
        executesAutomatically: false
      };
    },

    async inspect(taskId) {
      const capsule = await inspectStateCapsule(stateRoot, taskId);
      let topology = null;
      try {
        const payload = JSON.parse(await fs.readFile(topologyPath(stateRoot, taskId), "utf8"));
        topology = { path: topologyPath(stateRoot, taskId), integrity: decodePiTopology(payload).integrity };
      } catch (error) {
        topology = { path: topologyPath(stateRoot, taskId), integrity: { ok: false, reason: error.message || String(error) } };
      }
      return {
        status: capsule.integrity.ok && topology.integrity.ok ? "paused" : "attention-required",
        taskId: capsule.capsule.id,
        type: capsule.capsule.type,
        nextStep: capsule.capsule.state?.nextStep || capsule.capsule.context?.nextStep || null,
        dependencies: clone(capsule.capsule.dependencies),
        capsule: { path: capsule.path, integrity: capsule.integrity },
        topology,
        executesAutomatically: false
      };
    },

    async resume(taskId) {
      const graphFile = topologyPath(stateRoot, taskId);
      const graph = JSON.parse(await fs.readFile(graphFile, "utf8"));
      const graphIntegrity = decodePiTopology(graph).integrity;
      if (!graphIntegrity.ok) throw new Error("Runtime topology integrity check failed.");
      const taskFromTopology = capsuleFromTopology(graph, taskId);
      const dependencyCapsules = taskFromTopology.dependencies.map((id) => capsuleFromTopology(graph, id));
      const directTask = await restoreStateCapsule(stateRoot, taskFromTopology.id);
      const directDependencies = await Promise.all(dependencyCapsules.map((dependency) => restoreStateCapsule(stateRoot, dependency.id)));
      return {
        status: "ready-for-manual-resume",
        taskId: taskFromTopology.id,
        task: directTask.restoredObject,
        dependencies: directDependencies.map((dependency) => dependency.restoredObject),
        nextStep: directTask.restoredObject.state?.nextStep || directTask.restoredObject.context?.nextStep || null,
        integrity: {
          topology: graphIntegrity,
          task: directTask.integrity,
          dependencies: directDependencies.map((dependency) => ({ id: dependency.capsuleId, integrity: dependency.integrity }))
        },
        executesAutomatically: false
      };
    }
  };
}
