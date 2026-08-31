# Cognitive Runtime Core Invariants v0

The Runtime core is the continuity boundary. Extensions should be measured by
whether they change `runtime/cognitive-runtime.js`, not by whether the larger
Dock repository gains files.

| Extension or verification | Runtime core result |
| --- | --- |
| Dock manual adapter | unchanged |
| State Capsule / topology integration | unchanged after initial extraction |
| Manual calculator provider | unchanged |
| Manual Ollama provider | unchanged |
| Model A to Model B continuation | SHA-256 unchanged |
| Ollama `think: false` protocol quirk | unchanged |
| Fixed capability resolver | SHA-256 unchanged |
| Linux local host | passed under WSL2 Ubuntu; SHA-256 unchanged |
| Windows to Linux state portability | passed under WSL; SHA-256 unchanged |
| Cross-node transport | not tested |

This table is not a claim that the core can never evolve. It is a guardrail for
this stage: provider behavior, provider quirks, resolution policy, UI, and
host placement should remain outside the continuity core unless a concrete
continuity contract requires otherwise.
