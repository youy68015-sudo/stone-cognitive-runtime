# Cognitive Runtime Boundary and Node Readiness v0

## Current Layering

```text
Thought Field (internal, resident authority)
        |
        v
Cognitive Runtime (portable continuity contract)
        |
        v
Stable Runtime API
        |
        v
Dock Adapter
        |
        v
Dock (capability and world boundary)
        |
        v
Providers: Ollama/models, Browser, Vision, Voice, Body, devices, future nodes
```

The Cognitive Runtime is not a Dock child module. Dock is simply its first
host adapter. The core must not import or depend on Dock, Paimon UI, Ollama,
Windows paths, local ports, browser controls, or provider schemas.

Its state placement is also portable: `RUNTIME_STATE_ROOT` can explicitly set
the root. Without it, the core defaults to a per-user state location appropriate
to Windows or Linux. The root contains `capsules/`, `topology/`, and a reserved
`metadata/` directory. Host-specific placement is the adapter's responsibility.

## Dock Fit

The existing Paimon module router already has replaceable slots, provider
labels, a replacement map, and explicit route descriptions. Ollama is already
positioned behind `brain.primary` / `brain.digitalLifeText` as a replaceable
local model provider. The local-node inventory also distinguishes durable
resident state from transient workers.

What does **not** exist today is a generic runtime resolver of the form:

`requiredCapability -> eligible provider -> selected provider`

That is acceptable for the current stage. Adding it would be a new routing
feature and is intentionally out of scope. The present architecture is already
compatible with the provider-boundary interpretation without changing code.

## Future Two-Node Contract

Do not implement this until a real second trusted node exists. The minimum
contract to review then is:

| Contract | Minimum fields |
| --- | --- |
| Node identity | `nodeId`, owner, protocol version, declared trust scope, expiry/revocation handle |
| Capability advertisement | provider id, capability ids, version, limits, availability, data-class boundary |
| Capsule transfer | capsule id, schema/version, integrity hash, source node, transfer id, declared restore level |
| Dependency closure | required capsule ids, relation edges, missing/deferred dependencies, closure hash |
| Result write-back | originating task/capsule id, source version/hash, node id, result status, result hash, error summary |
| Reconnect | last acknowledged transfer/event id, idempotency key, replay window, explicit conflict status |

Existing `local-node-inventory-v0` and `guest-berth-spec-v0` already cover
parts of identity, capability declaration, ownership, authority, and local-only
rollout. This note is a compatibility checklist, not a second node protocol.

## Explicit Non-Goals

- no second node or network listener;
- no scheduler, distributed database, Kubernetes, automatic failover, or
  automatic capsule transfer;
- no BIU promotion, automatic resume, or live Xiao Guang integration;
- no UI change.
