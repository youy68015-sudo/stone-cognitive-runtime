import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createCognitiveRuntime, resolveRuntimeStateRoot } from "../runtime/cognitive-runtime.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const coreFiles = [
  "runtime/cognitive-runtime.js",
  "tools/state-capsule.js",
  "tools/pi-topology-compression.js"
].map((file) => path.join(ROOT, file));

const forbiddenImports = [
  /server\.js/,
  /dock-cognitive-runtime-adapter/,
  /dock-local-runtime/,
  /\.\.\/public\//,
  /[A-Za-z]:\\\\/
];

for (const file of coreFiles) {
  const source = await fs.readFile(file, "utf8");
  for (const forbidden of forbiddenImports) {
    assert.doesNotMatch(source, forbidden, `${path.relative(ROOT, file)} must not depend on ${forbidden}.`);
  }
}

const explicitRoot = path.join(ROOT, ".runtime-isolation-fixture");
assert.equal(resolveRuntimeStateRoot(explicitRoot), path.resolve(explicitRoot));
assert.equal(typeof createCognitiveRuntime({ stateRoot: explicitRoot }).suspend, "function");

console.log(JSON.stringify({
  status: "cognitive-runtime-isolation-test-passed",
  coreFiles: coreFiles.map((file) => path.relative(ROOT, file)),
  verified: [
    "no-server-import",
    "no-dock-adapter-import",
    "no-ui-import",
    "no-windows-path-literal",
    "caller-controlled-state-root"
  ]
}, null, 2));
