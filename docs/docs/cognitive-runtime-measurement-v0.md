# Minimal Cognitive Runtime Measurement v0

## Scope

This is a local measurement of the sandbox-only Cognitive Runtime experiment.
It does not measure a live Dock route, a model, vision, body, browser, or
thought-field workload. The harness creates temporary paused-task capsules and
removes them after every run.

## Source Footprint

| Component | LOC | Runtime role |
| --- | ---: | --- |
| `state-capsule.js` | 135 | Capture, verify, store, and restore contract |
| `pi-topology-compression.js` | 292 | Relation representation and partial restore |
| `bayesian-experience-weight.js` | 169 | BIU shadow metadata |
| Three imported pure primitives | 596 | Static transitive source footprint |
| `thought-unit-adapter.cjs` | 147 | Read-only architecture surface; not imported by runtime probe |

There is no `CognitiveRuntime` class, scheduler, or router. The current
orchestration is intentionally inline in test code. The test scaffolding is:

| File | LOC |
| --- | ---: |
| `test-cognitive-runtime-integration.js` | 162 |
| `test-cognitive-runtime-real-task.js` | 106 |
| `measure-cognitive-runtime.js` | 191 |
| Total scaffolding | 459 |

Therefore a separate “glue LOC” cannot honestly be reported as a reusable
runtime component: it is **0 LOC of production runtime glue**. The minimal
orchestration behavior is five explicit operations in the test flows: capture,
persist, attach BIU metadata, dependency-scoped topology lookup, and manual
resume handoff. Factoring that into a class merely to obtain a LOC number would
violate the no-new-runtime-core constraint.

## Cold Start

Measured in a fresh Node process importing only the three pure primitives:

| Metric | Result |
| --- | ---: |
| Module-ready time | 8.21 ms |
| Whole process wall time | 349.54 ms |
| Idle RSS after imports | 47.3 MB |
| Idle heap used after imports | 5.35 MB |

The process wall time includes Node startup. The Thought Unit Adapter was
excluded because it is an executable shared-state builder rather than a pure
import dependency.

## Paused-Task Scaling

| Paused tasks | Capsule JSON total | Topology JSON | Topology binary | Peak RSS | Persist / capsule | Partial restore | Direct capsule restore |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 1,822 B | 2,968 B | 1,153 B | 49.8 MB | 0.967 ms | 0.372 ms | 0.551 ms |
| 10 | 18,227 B | 12,636 B | 4,181 B | 53.6 MB | 0.574 ms | 0.500 ms | 0.372 ms |
| 100 | 182,844 B | 111,462 B | 36,749 B | 62.6 MB | 0.566 ms | 3.000 ms | 0.506 ms |

For 100 paused tasks, topology build was 33.51 ms. Every run verified that the
task’s dependency was recovered, its next step matched the direct Capsule
restore, and the resume recipe stayed non-executing.

## Interpretation

The continuity core remains modest relative to model, vision, or body
providers. This supports the architectural claim:

`Capability cost != continuity-core cost`

It does not demonstrate long-running production memory behavior, concurrent
writes, external-world consistency, live browser recovery, or automatic task
selection.
