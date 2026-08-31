# State Capsule / Digital Inventory Prototype v0.1

## Purpose

State Capsule is an isolated prototype for a digital "storage bag": preserve a
serializable object and its surrounding context now, then restore that object
later without pretending that every live runtime resource can be resumed.

It is deliberately separate from Dock, Xiao Guang, Aurora thought units, BIU,
browser sessions, and agent routing.

## Lifecycle

```text
capture(object) -> capsule -> store(capsule) -> inspect/verify -> restore(object')
```

Each capsule contains:

- `id`, `type`, `createdAt`, and `source`
- serializable `state` and `context`
- `relations` and `dependencies`
- a non-executing `restoreRecipe`
- restoration capability flags and `nonRestorable` notes
- a SHA-256 integrity hash over the captured payload

## Restore Levels

- **L0 data:** saved values can be read back.
- **L1 structure:** relations are preserved and can be checked against a
  restored set.
- **L2 context:** saved task or environment context returns with the object.
- **L3 operational recipe:** a resume recipe is preserved for a future owner;
  this prototype never executes it automatically.

L3 is intentionally not a claim that arbitrary process memory, browser tabs,
or model runtime state can be serialized safely.

## Boundary

The prototype only accepts explicitly supplied JSON-compatible test objects.
It does not capture running processes, credentials, browser sessions, local
files, thought-unit state, or agent memory. It cannot delete, overwrite, or
execute a restored object.

## Verification

`tools/test-state-capsule.js` proves:

1. capture, store, inspect, and restore of a paused task object;
2. cross-process restore using a second Node process;
3. restoration of a related task/note pair with relation checks intact;
4. detection of a deliberately modified capsule by SHA-256 mismatch.

## Future Adoption

Only after a real Dock need appears should an adapter nominate a narrow,
non-sensitive state type for capture. BIU may later recommend that a low-use
candidate be retained, but BIU must never call capture or restore itself.

### Optional Topology Companion

Pi-map topology is not a compression backend for State Capsule: raw JSON plus
zstd won every measured storage comparison. It remains a possible companion
when a future capsule has explicit relationships and a real need to restore a
single related subtree without materialising the full captured state.

Keep the responsibilities separate:

- **State Capsule:** capture, integrity, store, inspect, and restore contract.
- **Topology companion:** relation-aware representation and in-memory partial
  restore after a topology graph has been explicitly loaded.

Do not couple them until a real paused-task workflow demonstrates that the
partial-restore behavior is more valuable than the added representation cost.
