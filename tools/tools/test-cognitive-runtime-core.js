import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createCognitiveRuntime } from "../runtime/cognitive-runtime.js";

const stateRoot = await fs.mkdtemp(path.join(os.tmpdir(), "cognitive-runtime-core-"));
try {
  const runtime = createCognitiveRuntime({ stateRoot });
  const suspended = await runtime.suspend({
    task: {
      id: "runtime-core-task-a",
      type: "paused-research-task",
      source: { kind: "test" },
      state: { completedSteps: ["inspect source"], nextStep: "compare evidence" },
      context: { biuShadow: { mode: "inspectable-shadow-only", tier: "active-exploration" } },
      dependencies: ["runtime-core-note-a"],
      restoreRecipe: { kind: "manual-resume-recipe", executesAutomatically: false }
    },
    dependencies: [{
      id: "runtime-core-note-a",
      type: "evidence-note",
      source: { kind: "test" },
      state: { finding: "source was observed" },
      context: { taskId: "runtime-core-task-a" }
    }]
  });
  assert.equal(suspended.status, "paused");
  assert.equal(suspended.executesAutomatically, false);
  const inspected = await runtime.inspect("runtime-core-task-a");
  assert.equal(inspected.status, "paused");
  assert.equal(inspected.capsule.integrity.ok, true);
  assert.equal(inspected.topology.integrity.ok, true);

  const moduleUrl = new URL("../runtime/cognitive-runtime.js", import.meta.url).href;
  const child = `
    import { createCognitiveRuntime } from ${JSON.stringify(moduleUrl)};
    const runtime = createCognitiveRuntime({ stateRoot: process.argv[1] });
    console.log(JSON.stringify(await runtime.resume("runtime-core-task-a")));
  `;
  const resumed = JSON.parse(execFileSync(process.execPath, ["--input-type=module", "-e", child, stateRoot], { encoding: "utf8" }));
  assert.equal(resumed.status, "ready-for-manual-resume");
  assert.equal(resumed.nextStep, "compare evidence");
  assert.equal(resumed.dependencies[0].state.finding, "source was observed");
  assert.equal(resumed.task.context.biuShadow.mode, "inspectable-shadow-only");
  assert.equal(resumed.executesAutomatically, false);
  console.log(JSON.stringify({ status: "cognitive-runtime-core-test-passed", stateRoot: "temporary", resumed }, null, 2));
} finally {
  await fs.rm(stateRoot, { recursive: true, force: true });
}
