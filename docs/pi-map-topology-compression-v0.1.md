# Pi-map Multi-layer Topological Compression v0.1

## Question

Can a deterministic pi-map plus shared topology representation provide useful,
lossless compression for highly related digital state objects?

The pi-map is treated only as reconstructable coordinate metadata. It does not
claim that pi provides free information or an unlimited lookup table.

## Prototype

`tools/pi-topology-compression.js` implements a reversible structural encoder:

1. intern repeated strings;
2. deduplicate identical arrays and objects into a topology node layer;
3. preserve object references through node indexes;
4. retain a SHA-256 source hash for round-trip verification;
5. expose deterministic pi-derived coordinates without storing one coordinate
   per node.

The benchmark fixture models 180 related paused-task/state-capsule-like objects
with repeated context, dependencies, recipes, and partially repeated evidence.

## Result

Latest benchmark on 2026-08-21:

| Representation | Bytes |
| --- | ---: |
| Raw JSON | 84,473 |
| Pi-topology JSON | 57,355 |
| Raw JSON + gzip | 2,344 |
| Pi-topology JSON + gzip | 5,491 |
| Raw JSON + Brotli | 1,176 |
| Pi-topology JSON + Brotli | 2,906 |
| Raw JSON + zstd | 1,769 |
| Pi-topology JSON + zstd | 4,319 |

The prototype is lossless. Encoding took about 12 ms and decoding about 4 ms
for the fixture. Structural deduplication reduced the transparent JSON form by
about 32%, but established entropy codecs compress the original JSON much more
effectively. Therefore v0.1 is **not a practical storage replacement**.

## v0.2 Follow-up: Binary Form and Partial Restore

v0.2 adds a compact binary representation for the same topology graph and an
in-memory subtree restore primitive. It keeps the v0.1 JSON form unchanged so
the representation remains inspectable.

| Representation | Bytes |
| --- | ---: |
| Pi-topology binary | 12,950 |
| Pi-topology binary + gzip | 4,248 |
| Pi-topology binary + Brotli | 2,749 |
| Pi-topology binary + zstd | 3,602 |

The binary form removes JSON syntax and repeated field names, reducing the
topology payload substantially. It still loses to compressed raw JSON, so it
does not change the storage conclusion.

The useful new signal is operational: restoring one stored task subtree from
an already loaded topology graph completed in about 0.05 ms without
materialising the full root object. This is not random-access disk restore
yet, but it is a credible primitive for a future paused-task or state-capsule
workflow.

## Scale Check

`tools/benchmark-pi-topology-scale.js` measures low, medium, and high
structural repetition at 100 KiB, 1 MiB, and 10 MiB, plus a 100 MiB high-share
case. Its purpose is to distinguish fixed overhead from a genuine large-scale
shared-topology advantage. The comparison includes raw JSON and topology
forms before and after gzip, Brotli, and zstd.

The scale run completed on 2026-08-21. The expected structural trend appears:
for the high-share case, raw JSON grew to 88,676,766 bytes while the binary
topology form was 11,451,496 bytes. That confirms that topology sharing can
amortise its own metadata at larger scale.

It did **not** become an entropy-compression win. On that same high-share
case, raw JSON plus zstd was 501,663 bytes, compared with 2,391,289 bytes for
binary topology plus zstd. The result is consistent across low, medium, and
high repetition inputs: established codecs extract repeated byte patterns
more effectively than this current topology representation.

This rules out the simple explanation that the v0.1 result only lost because
the fixture was too small. The representation remains useful for explicit
relations and partial state recovery; byte reduction is not its adoption case.

## 2x2 Structure vs Byte-Repetition Check

The matrix benchmark was also run with four approximately 5 MiB cases:

| Case | Raw JSON + zstd | Binary topology + zstd |
| --- | ---: | ---: |
| A: low topology share, low byte share | 1,068,805 | 1,417,834 |
| B: low topology share, high byte share | 450,533 | 650,544 |
| C: high topology share, low byte share | 903,291 | 1,053,049 |
| D: high topology share, high byte share | 57,753 | 181,602 |

Case C is the important diagnostic: its object shapes match while their
payload values differ. Raw zstd still wins. This is expected for v0.2 because
it only deduplicates *identical values*; it has no template-and-residual layer
that can represent isomorphic object shapes with distinct field values.

Therefore the next compression-specific research question is not whether to
increase fixture size. It is whether a separate, lossless structural-template
representation can preserve one shape once and store each object's residual
values separately. That would be a new v0.3 experiment, not a change to the
current State Capsule companion.

## Conclusion

The useful result is a verified representation experiment, not a production
compressor. It confirms that shared topology can be captured and reconstructed,
but has not demonstrated a net compression gain once codebook/index overhead
and modern codecs are included.

Do not connect it to State Capsule, Dock, BIU, or Xiao Guang yet. The next
useful experiment, if a real need appears, is an indexed on-disk partial
restore for explicitly selected State Capsule test data. It should be judged
on resume/retrieval behavior rather than compression claims.
