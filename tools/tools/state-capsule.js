import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

function clone(value) {
  return value === undefined ? null : JSON.parse(JSON.stringify(value));
}

function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function digest(value) {
  return createHash("sha256").update(stable(value)).digest("hex");
}

function capsulePayload(capsule = {}) {
  return {
    id: capsule.id,
    type: capsule.type,
    createdAt: capsule.createdAt,
    source: capsule.source,
    state: capsule.state,
    context: capsule.context,
    relations: capsule.relations,
    dependencies: capsule.dependencies,
    restoreRecipe: capsule.restoreRecipe,
    restoration: capsule.restoration
  };
}

function normalizeRelations(relations = []) {
  return (Array.isArray(relations) ? relations : []).map((relation) => ({
    type: String(relation?.type || "related-to").slice(0, 80),
    targetId: String(relation?.targetId || "").slice(0, 160),
    label: String(relation?.label || "").slice(0, 160)
  })).filter((relation) => relation.targetId);
}

export function captureStateCapsule(input = {}) {
  if (!input || typeof input !== "object") throw new Error("State Capsule capture requires an object input.");
  const createdAt = input.createdAt || new Date().toISOString();
  const capsule = {
    schema: "state-capsule-v0.1",
    id: String(input.id || `capsule-${randomUUID()}`),
    type: String(input.type || "test-object").slice(0, 120),
    createdAt,
    source: clone(input.source || { kind: "prototype" }),
    state: clone(input.state || {}),
    context: clone(input.context || {}),
    relations: normalizeRelations(input.relations),
    dependencies: clone(Array.isArray(input.dependencies) ? input.dependencies : []),
    restoreRecipe: clone(input.restoreRecipe || { kind: "data-rehydrate", executesAutomatically: false }),
    restoration: {
      l0Data: true,
      l1Structure: normalizeRelations(input.relations).length > 0,
      l2Context: Object.keys(input.context || {}).length > 0,
      // This prototype preserves an operational resume recipe but never runs it.
      l3OperationalRecipe: Boolean(input.resumeState || input.restoreRecipe?.kind === "resume-recipe"),
      nonRestorable: clone(input.nonRestorable || [])
    }
  };
  capsule.integrity = {
    algorithm: "sha256",
    captureHash: digest(capsulePayload(capsule))
  };
  return capsule;
}

export function verifyStateCapsule(capsule = {}) {
  const expected = String(capsule?.integrity?.captureHash || "");
  const actual = digest(capsulePayload(capsule));
  return {
    ok: Boolean(expected) && expected === actual,
    expected: expected || null,
    actual,
    reason: !expected ? "missing-capture-hash" : expected === actual ? null : "capture-hash-mismatch"
  };
}

function capsulePath(rootDir, id) {
  return path.join(rootDir, "capsules", `${encodeURIComponent(id)}.json`);
}

export async function storeStateCapsule(rootDir, capsule) {
  const verification = verifyStateCapsule(capsule);
  if (!verification.ok) throw new Error(`Refusing to store invalid capsule: ${verification.reason}.`);
  const output = capsulePath(rootDir, capsule.id);
  await fs.mkdir(path.dirname(output), { recursive: true });
  await fs.writeFile(output, `${JSON.stringify(capsule, null, 2)}\n`, "utf8");
  return { path: output, capsuleId: capsule.id, integrity: verification };
}

export async function inspectStateCapsule(rootDir, capsuleId) {
  const file = capsulePath(rootDir, capsuleId);
  const capsule = JSON.parse(await fs.readFile(file, "utf8"));
  return { path: file, capsule, integrity: verifyStateCapsule(capsule) };
}

export async function restoreStateCapsule(rootDir, capsuleId) {
  const inspected = await inspectStateCapsule(rootDir, capsuleId);
  if (!inspected.integrity.ok) throw new Error(`Refusing to restore invalid capsule: ${inspected.integrity.reason}.`);
  const { capsule } = inspected;
  return {
    capsuleId: capsule.id,
    type: capsule.type,
    restoredObject: {
      id: capsule.id,
      type: capsule.type,
      state: clone(capsule.state),
      context: clone(capsule.context),
      relations: clone(capsule.relations),
      dependencies: clone(capsule.dependencies),
      restoreRecipe: clone(capsule.restoreRecipe)
    },
    restoration: clone(capsule.restoration),
    integrity: inspected.integrity
  };
}

export async function restoreStateCapsuleSet(rootDir, capsuleIds = []) {
  const restored = await Promise.all(capsuleIds.map((id) => restoreStateCapsule(rootDir, id)));
  const ids = new Set(restored.map((item) => item.capsuleId));
  const relationChecks = restored.flatMap((item) => item.restoredObject.relations.map((relation) => ({
    from: item.capsuleId,
    to: relation.targetId,
    type: relation.type,
    restored: ids.has(relation.targetId)
  })));
  return { restored, relationChecks, relationsIntact: relationChecks.every((check) => check.restored) };
}
