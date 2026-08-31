# Cognitive Runtime API v0

`runtime/cognitive-runtime.js` is a portable user-space continuity core. It
uses State Capsule and topology primitives but does not import Dock, model,
tool, UI, device, or operating-system integration code.

## Core Contract

The core exposes exactly three manual operations:

| Operation | Input | Result |
| --- | --- | --- |
| `suspend` | task state plus complete dependency states | captures capsules and persists one dependency-scoped topology graph |
| `inspect` | task id | reports capsule/topology integrity and the saved next step |
| `resume` | task id | restores the task and declared dependency states as a non-executing resume contract |

Every result explicitly includes `executesAutomatically: false`. The core does
not select a task, rank tasks, start a provider, execute a restore recipe, or
auto-resume work.

BIU is not imported by the core. A caller may attach BIU shadow metadata to a
task context, and the core preserves it as ordinary state.

## Dock Adapter

`tools/dock-cognitive-runtime-adapter.js` supplies Dock's explicit state root
and forwards the same three operations without adding policy. The current Dock
routes are manual and local:

| Method | Route |
| --- | --- |
| `POST` | `/api/paimon-dock/cognitive-runtime/suspend` |
| `GET` | `/api/paimon-dock/cognitive-runtime/tasks/:taskId` |
| `POST` | `/api/paimon-dock/cognitive-runtime/tasks/:taskId/resume` |

The server chooses `PAIMON_COGNITIVE_RUNTIME_STATE_ROOT`, defaulting to
`<ALLIANCE_DATA_DIR>/cognitive-runtime`. This host choice does not enter the
portable Runtime contract.

## Deliberate Non-Goals

- no `autoResume`, scheduler, routing, priority decision, or provider resolver;
- no live Xiao Guang workflow or Thought Unit mutation;
- no model, browser, vision, body, device, remote-node, or UI integration;
- no kernel code, root privilege, or Linux distribution work.

Linux validation later only needs Node.js plus a writable `RUNTIME_STATE_ROOT`.
The same core API can then be hosted by a headless service, Dock adapter, or a
future node transport.

## Isolation Regression Check

`tools/test-cognitive-runtime-isolation.js` statically checks the portable core
and its two direct primitives for forbidden imports of `server.js`, the Dock
adapter/local runtime, UI modules, and Windows drive-path literals. The runtime
core test separately runs its suspend/inspect/resume lifecycle from a fresh
Node process without starting Dock.
