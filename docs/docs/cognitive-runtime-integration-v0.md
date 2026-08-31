# Cognitive Runtime Integration v0

## Purpose

This is a one-shot, isolated compatibility test for four existing components:

`Thought Unit reference -> BIU shadow metadata -> State Capsule -> topology partial restore`

It is not an operating system, scheduler, agent loop, new memory format, or
Dock feature. It does not change a live thought unit, Xiao Guang, BIU routing,
or any Aurora state.

## Test Contract

The test creates a single paused task and one related evidence note. It proves:

1. **Suspend:** the active task can be represented as an explicit capsule.
2. **Persist:** the capsule survives a fresh Node process with a valid hash.
3. **Prioritize:** BIU supplies inspectable shadow metadata only.
4. **Partial restore:** a persisted topology graph finds the task and its
   declared dependency without materialising the root graph.
5. **Resume contract:** the restored task retains its `nextStep`; its stored
   recipe explicitly does not execute automatically.

The thought-unit input is a read-only snapshot of the existing adapter state
when available. If Aurora is not mounted, the test uses a contract fixture so
the test remains portable. It never launches or writes the adapter.

## Boundaries

- Temporary files only, removed at the end of the test.
- No Dock server restart or route change.
- No thought-unit mutation, hatching, or field update.
- No BIU live routing or automatic capture/restore.
- No browser, process, credential, or device state capture.

Run with:

```powershell
node tools\test-cognitive-runtime-integration.js
```

Passing this test means the components can exchange a minimal paused-task
contract through a thin adapter. It does not prove that they should yet be
integrated into Xiao Guang's live workflow.

## Read-Only Task Verification

`tools/test-cognitive-runtime-real-task.js` performs a real but deliberately
small local task:

1. read the State Capsule documentation and capture its evidence;
2. suspend a comparison task with its declared next step;
3. persist the task and evidence as capsules plus a topology graph;
4. start a fresh Node process;
5. partially recover only the task and evidence, then read the topology
   documentation to complete the saved comparison step.

The test is read-only with respect to repository documentation and removes its
temporary persistence directory afterward. It demonstrates actual task
continuity, not autonomous scheduling or live agent control.
