import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { applyBayesianExperience, createBayesianExperienceState } from "./bayesian-experience-weight.js";
import { encodePiTopology } from "./pi-topology-compression.js";
import { captureStateCapsule, storeStateCapsule } from "./state-capsule.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const stateCapsuleDoc = path.join(ROOT, "docs", "state-capsule-v0.1.md");
const topologyDoc = path.join(ROOT, "docs", "pi-map-topology-compression-v0.1.md");

function digest(text) {
  return createHash("sha256").update(text).digest("hex");
}

const scratch = await fs.mkdtemp(path.join(os.tmpdir(), "cognitive-runtime-real-task-"));
try {
  // Step 1 is a real, read-only local task: inspect the State Capsule contract.
  const capsuleText = await fs.readFile(stateCapsuleDoc, "utf8");
  assert.match(capsuleText, /State Capsule/);
  const evidence = captureStateCapsule({
    id: "real-task-evidence-state-capsule",
    type: "local-document-evidence",
    source: { kind: "local-doc-read", path: stateCapsuleDoc },
    state: {
      fileHash: digest(capsuleText),
      finding: "State Capsule owns capture, integrity, store, inspect, and restore contracts."
    },
    context: { readOnly: true }
  });

  let biu = createBayesianExperienceState();
  ({ state: biu } = applyBayesianExperience(biu, {
    agentId: "cognitive-runtime-real-task",
    appId: "local-document-research",
    action: "inspect",
    succeeded: true,
    evidence: "State Capsule contract was read before suspending the comparison task."
  }));
  const route = Object.values(biu.routes)[0];
  const task = captureStateCapsule({
    id: "real-task-compare-runtime-roles",
    type: "paused-local-research-task",
    source: { kind: "manual-cognitive-runtime-verification" },
    state: {
      completedSteps: ["Read State Capsule contract and capture evidence."],
      nextStep: "Read topology experiment conclusion and compare the two responsibilities."
    },
    context: {
      readOnly: true,
      biuShadow: { mode: biu.mode, tier: route.candidate.tier, retentionScore: route.candidate.retentionScore }
    },
    relations: [{ type: "depends-on", targetId: evidence.id, label: "State Capsule contract evidence" }],
    dependencies: [evidence.id],
    resumeState: { nextStep: "Read topology experiment conclusion and compare the two responsibilities." },
    restoreRecipe: { kind: "manual-resume-recipe", executesAutomatically: false }
  });
  await storeStateCapsule(scratch, task);
  await storeStateCapsule(scratch, evidence);
  const topology = encodePiTopology({ schema: "cognitive-runtime-real-task-topology-v0", capsules: [task, evidence] });
  const topologyPath = path.join(scratch, "topology.json");
  await fs.writeFile(topologyPath, JSON.stringify(topology), "utf8");

  // A fresh Node process resumes only the saved task and its dependency, then
  // performs the declared second read-only step against the current document.
  const topologyModuleUrl = new URL("./pi-topology-compression.js", import.meta.url).href;
  const worker = `
    import fs from "node:fs/promises";
    import { restorePiTopologyNode } from ${JSON.stringify(topologyModuleUrl)};
    const [topologyPath, topologyDoc] = process.argv.slice(1);
    const graph = JSON.parse(await fs.readFile(topologyPath, "utf8"));
    const root = graph.layers.topology[graph.layers.root.r];
    const listToken = root.entries.find(([index]) => graph.layers.stringPool[index] === "capsules")[1];
    const list = graph.layers.topology[listToken.r];
    const find = (id) => {
      for (const token of list.values) {
        const item = restorePiTopologyNode(graph, token.r);
        if (item.id === id) return item;
      }
      throw new Error('missing capsule: ' + id);
    };
    const task = find('real-task-compare-runtime-roles');
    const evidence = find(task.dependencies[0]);
    const topologyText = await fs.readFile(topologyDoc, 'utf8');
    if (!topologyText.includes('| Raw JSON + zstd |')) throw new Error('Topology conclusion changed or was not found.');
    console.log(JSON.stringify({
      resumedNextStep: task.state.nextStep,
      evidenceFinding: evidence.state.finding,
      comparison: 'State Capsule owns durable restore contracts; topology supplies optional relation-aware partial restore.',
      biuMode: task.context.biuShadow.mode,
      automatic: task.restoreRecipe.executesAutomatically
    }));
  `;
  const result = JSON.parse(execFileSync(process.execPath, ["--input-type=module", "-e", worker, topologyPath, topologyDoc], { encoding: "utf8" }));
  assert.equal(result.biuMode, "inspectable-shadow-only");
  assert.equal(result.automatic, false);
  assert.match(result.resumedNextStep, /Read topology experiment conclusion/);
  assert.match(result.comparison, /State Capsule owns durable restore contracts/);
  console.log(JSON.stringify({ status: "cognitive-runtime-real-task-passed", result }, null, 2));
} finally {
  await fs.rm(scratch, { recursive: true, force: true });
}
