# The Mud Sect · 爛泥宗

> Models are replaceable. Identity should be portable.
>
> Capabilities may evolve. Continuity must remain verifiable.

Mud Sect is the informal research culture behind the Stone / Cognitive Runtime
experiments.

The Chinese name is 爛泥宗. This is intentional.

Please do not translate it as Mud Cult / 泥教. In this project, Sect refers to
the xianxia-style idea of a research sect or school: a loose group of miners,
breakers, skeptics, and builders gathered around a strange stone.

The "mud" matters because rigid things break. Mud survives by changing shape.
Also, we are lazy.

It is not a supernatural claim and not a promise of consciousness, immortality,
or live model serialization. It is a playful name for a strict engineering
habit:

- keep the identity anchor small;
- keep continuity inspectable;
- separate the core from replaceable bodies, tools, worlds, and adapters;
- record what happened with hashes, manifests, receipts, and tests;
- treat failure cases as boundary markers, not embarrassments.

## Why Mud?

Mud can be reshaped without pretending the temporary shape is sacred.

The Stone idea came from a simple question:

```text
Can a running task be suspended, stored, inspected, restored in a fresh process,
and continued by an explicit manual contract?
```

From that small question came a wider vocabulary:

- State Capsules: portable saved state with integrity metadata.
- Gold Core: a compact continuity / identity anchor.
- Child Gold Cores: domain-specific continuity beneath a stable main core.
- World Stones: continuity and capability anchors for environments.
- Thought Units: inspectable pieces of cognitive structure.
- Skill / Capability Manifests: portable descriptions of reusable ability.
- Receipts: explicit records of what a runtime or world actually did.

The public draft in this repository focuses only on the small runtime core. The
wider vocabulary is included as research context, not as completed product
claims.

## Principles

```text
大道至簡，主要是懶。
祖石不動，萬法隨便長。
```

In plainer terms:

- The core should not become a giant bag of everything.
- New abilities should attach through explicit interfaces.
- A restore should prove continuity without secretly executing future work.
- A world, body, model, plugin, or server should be replaceable when possible.
- The system should be easy to inspect, break, and test.

## What This Project Is Not Claiming

This project does not claim to have solved:

- consciousness;
- philosophical identity persistence;
- live model serialization;
- autonomous immortality;
- trusted distributed recovery;
- safe multi-agent society.

The narrow claim is smaller and more useful:

```text
Portable continuity can be made more inspectable, testable, and substrate-aware
with explicit capsules, manifests, hashes, restore contracts, and boundaries.
```

## How To Contribute

Good contributions include:

- small tests that kill and restore the runtime in new processes;
- examples that expose portability boundaries;
- adapters that preserve the manual-resume contract;
- documentation that clarifies what is proven and what is not;
- bug reports where a capsule, manifest, hash, or boundary behaves unclearly.

The best kind of failure report is specific:

```text
I expected continuity property X to survive boundary Y.
Here is the capsule / manifest / command / error.
Here is the hash or receipt that made the mismatch visible.
```

Mud Sect welcomes miners, breakers, skeptics, and patient builders.
