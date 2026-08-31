# Stone Cognitive Runtime Public Draft v0

> Models are replaceable. Identity should be portable.

## Status

This is a public-release draft package for the Stone / Cognitive Runtime core.
It is released under the MIT License.

## Scope

This package contains a small user-space runtime for explicit continuity:

```text
suspend -> persist -> inspect -> fresh process -> manual resume contract
```

It includes:

- state capsules with integrity checks;
- relation-aware topology compression;
- a caller-controlled runtime state root;
- a BIU-style inspectable shadow score;
- focused tests for isolation and restore behavior;
- technical notes describing the boundaries.

It deliberately excludes:

- Dock server code;
- resident or agent memories;
- live local state;
- browser data;
- account data;
- credentials;
- model weights;
- private-cloud nodes;
- game worlds;
- UI assets;
- machine-specific configuration.

## Install

```bash
npm install
```

The current package has no required runtime dependencies beyond Node.js built-in
modules. Node.js 20 or newer is recommended.

## Run Tests

```bash
node tools/test-cognitive-runtime-core.js
node tools/test-cognitive-runtime-isolation.js
node tools/test-cognitive-runtime-real-task.js
```

## Minimal Use

```js
import { createCognitiveRuntime } from "./runtime/cognitive-runtime.js";

const runtime = createCognitiveRuntime({ stateRoot: "./.stone-state" });

await runtime.suspend({
  task: {
    id: "example-task",
    type: "manual-task",
    source: { kind: "example" },
    state: {
      completedSteps: ["captured current state"],
      nextStep: "resume manually"
    },
    restoreRecipe: {
      kind: "manual-resume-recipe",
      executesAutomatically: false
    }
  }
});

console.log(await runtime.resume("example-task"));
```

## Boundary

Restoring a capsule returns state and a manual resume contract. It does not
automatically execute future work.

## The Mud Sect · 爛泥宗

The informal research culture behind this draft is documented in
`MUD-SECT.md`.

Short version: keep the core small, verifiable, and hard to kill; let everything
else grow as replaceable structures around it.

## Support / 香火箱

Donation and sponsorship links are not configured yet.

For now, the best support is to test the runtime, break it carefully, report
clear boundaries, and contribute small reproducible experiments.

See `manifest.json` for file hashes.
