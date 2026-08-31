import { createHash } from "node:crypto";

const PI_DIGITS = "3141592653589793238462643383279502884197169399375105820974944592";

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256(value) {
  return createHash("sha256").update(canonical(value)).digest("hex");
}

function decodeTopologyLayers(layers = {}, token) {
  const strings = layers.stringPool || [];
  const nodes = layers.topology || [];
  const cache = new Map();
  const decodeToken = (current) => {
    if (current && typeof current === "object" && Object.hasOwn(current, "s")) {
      if (!Number.isInteger(current.s) || current.s < 0 || current.s >= strings.length) throw new Error(`String reference ${current.s} is missing.`);
      return strings[current.s];
    }
    if (current && typeof current === "object" && Object.hasOwn(current, "r")) return decodeNode(current.r);
    return current;
  };
  const decodeNode = (index) => {
    if (!Number.isInteger(index) || index < 0 || index >= nodes.length) throw new Error(`Topology node ${index} is missing.`);
    if (cache.has(index)) return cache.get(index);
    const node = nodes[index];
    if (!node) throw new Error(`Topology node ${index} is missing.`);
    const output = node.kind === "array" ? [] : {};
    cache.set(index, output);
    if (node.kind === "array") {
      output.push(...node.values.map(decodeToken));
    } else if (node.kind === "object") {
      for (const [keyIndex, value] of node.entries) {
        if (!Number.isInteger(keyIndex) || keyIndex < 0 || keyIndex >= strings.length) throw new Error(`Object key reference ${keyIndex} is missing.`);
        output[strings[keyIndex]] = decodeToken(value);
      }
    } else {
      throw new Error(`Unknown topology node kind: ${node.kind}`);
    }
    return output;
  };
  return { value: decodeToken(token), decodeNode };
}

function writeVarint(chunks, value) {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`Invalid varint value: ${value}`);
  let remaining = value;
  const bytes = [];
  do {
    let byte = remaining % 128;
    remaining = Math.floor(remaining / 128);
    if (remaining) byte |= 0x80;
    bytes.push(byte);
  } while (remaining);
  chunks.push(Buffer.from(bytes));
}

function readVarint(reader) {
  let value = 0;
  let multiplier = 1;
  for (let index = 0; index < 10; index += 1) {
    const byte = reader.byte();
    value += (byte & 0x7f) * multiplier;
    if (!(byte & 0x80)) {
      if (!Number.isSafeInteger(value)) throw new Error("Varint exceeds safe integer range.");
      return value;
    }
    multiplier *= 128;
  }
  throw new Error("Invalid varint.");
}

class BufferReader {
  constructor(buffer) {
    this.buffer = Buffer.from(buffer);
    this.offset = 0;
  }

  take(length) {
    if (!Number.isInteger(length) || length < 0 || this.offset + length > this.buffer.length) throw new Error("Unexpected end of binary topology payload.");
    const value = this.buffer.subarray(this.offset, this.offset + length);
    this.offset += length;
    return value;
  }

  byte() {
    return this.take(1)[0];
  }
}

function writeToken(chunks, value) {
  if (value === null) return chunks.push(Buffer.from([0]));
  if (value === false) return chunks.push(Buffer.from([1]));
  if (value === true) return chunks.push(Buffer.from([2]));
  if (typeof value === "number") {
    const bytes = Buffer.allocUnsafe(9);
    bytes[0] = 3;
    bytes.writeDoubleLE(value, 1);
    return chunks.push(bytes);
  }
  if (value && typeof value === "object" && Object.hasOwn(value, "s")) {
    chunks.push(Buffer.from([4]));
    return writeVarint(chunks, value.s);
  }
  if (value && typeof value === "object" && Object.hasOwn(value, "r")) {
    chunks.push(Buffer.from([5]));
    return writeVarint(chunks, value.r);
  }
  throw new Error("Topology token is not binary encodable.");
}

function readToken(reader) {
  const tag = reader.byte();
  if (tag === 0) return null;
  if (tag === 1) return false;
  if (tag === 2) return true;
  if (tag === 3) return reader.take(8).readDoubleLE(0);
  if (tag === 4) return { s: readVarint(reader) };
  if (tag === 5) return { r: readVarint(reader) };
  throw new Error(`Unknown binary topology token tag: ${tag}`);
}

export function piCoordinate(index, layer = 0) {
  const start = (index * 7 + layer * 13) % PI_DIGITS.length;
  return Array.from({ length: 8 }, (_, offset) => PI_DIGITS[(start + offset) % PI_DIGITS.length]).join("");
}

export function encodePiTopology(input) {
  const strings = [];
  const stringIndex = new Map();
  const nodes = [];
  const nodeIndex = new Map();
  const internString = (value) => {
    const text = String(value);
    if (stringIndex.has(text)) return stringIndex.get(text);
    const index = strings.length;
    strings.push(text);
    stringIndex.set(text, index);
    return index;
  };
  const token = (value) => {
    if (typeof value === "string") return { s: internString(value) };
    if (value === null || typeof value === "boolean" || typeof value === "number") return value;
    if (!value || typeof value !== "object") throw new Error("Input must be JSON-compatible.");
    const key = canonical(value);
    if (nodeIndex.has(key)) return { r: nodeIndex.get(key) };
    const index = nodes.length;
    nodeIndex.set(key, index);
    // Reserve the slot before walking children so repeated nested structures
    // share one node in the topology rather than being expanded repeatedly.
    nodes.push(null);
    nodes[index] = Array.isArray(value)
      ? { kind: "array", values: value.map(token) }
      : {
        kind: "object",
        entries: Object.keys(value).sort().map((keyName) => [internString(keyName), token(value[keyName])])
      };
    return { r: index };
  };
  const root = token(input);
  const payload = {
    schema: "pi-map-topology-compression-v0.1",
    piMap: {
      rule: "node-index-digit-window-v0",
      digits: PI_DIGITS,
      coordinateStored: false,
      note: "Coordinates are deterministic reconstruction metadata; they are not claimed as a source of free compression."
    },
    layers: {
      stringPool: strings,
      // Coordinates are derived from the shared rule during use. Storing them
      // per node would turn a reusable map into pure overhead.
      topology: nodes,
      root
    },
    integrity: {
      algorithm: "sha256",
      sourceHash: sha256(input)
    }
  };
  return payload;
}

export function decodePiTopology(payload = {}) {
  if (payload.schema !== "pi-map-topology-compression-v0.1") throw new Error("Unsupported pi-topology payload.");
  const value = decodeTopologyLayers(payload.layers, payload.layers?.root).value;
  return {
    value,
    integrity: {
      expected: payload.integrity?.sourceHash || null,
      actual: sha256(value),
      ok: Boolean(payload.integrity?.sourceHash) && payload.integrity.sourceHash === sha256(value)
    }
  };
}

// Restores one reachable topology node without materialising the root object.
// This is an in-memory partial restore primitive; it does not claim random disk access.
export function restorePiTopologyNode(payload = {}, index) {
  if (payload.schema !== "pi-map-topology-compression-v0.1") throw new Error("Unsupported pi-topology payload.");
  return decodeTopologyLayers(payload.layers, { r: index }).value;
}

export function encodePiTopologyBinary(input) {
  const topology = encodePiTopology(input);
  const chunks = [Buffer.from("PTC2", "ascii")];
  const sourceHash = Buffer.from(topology.integrity.sourceHash, "hex");
  if (sourceHash.length !== 32) throw new Error("Invalid source hash.");
  chunks.push(sourceHash);
  const strings = topology.layers.stringPool;
  const nodes = topology.layers.topology;
  writeVarint(chunks, strings.length);
  for (const text of strings) {
    const bytes = Buffer.from(text, "utf8");
    writeVarint(chunks, bytes.length);
    chunks.push(bytes);
  }
  writeVarint(chunks, nodes.length);
  for (const node of nodes) {
    if (node.kind === "array") {
      chunks.push(Buffer.from([0]));
      writeVarint(chunks, node.values.length);
      for (const value of node.values) writeToken(chunks, value);
    } else if (node.kind === "object") {
      chunks.push(Buffer.from([1]));
      writeVarint(chunks, node.entries.length);
      for (const [keyIndex, value] of node.entries) {
        writeVarint(chunks, keyIndex);
        writeToken(chunks, value);
      }
    } else {
      throw new Error(`Unknown topology node kind: ${node.kind}`);
    }
  }
  writeToken(chunks, topology.layers.root);
  return { schema: "pi-map-topology-compression-v0.2-binary", bytes: Buffer.concat(chunks), topology };
}

export function decodePiTopologyBinary(buffer) {
  const reader = new BufferReader(buffer);
  if (reader.take(4).toString("ascii") !== "PTC2") throw new Error("Unsupported binary topology payload.");
  const sourceHash = reader.take(32).toString("hex");
  const strings = Array.from({ length: readVarint(reader) }, () => reader.take(readVarint(reader)).toString("utf8"));
  const nodes = Array.from({ length: readVarint(reader) }, () => {
    const kind = reader.byte();
    const count = readVarint(reader);
    if (kind === 0) return { kind: "array", values: Array.from({ length: count }, () => readToken(reader)) };
    if (kind === 1) return { kind: "object", entries: Array.from({ length: count }, () => [readVarint(reader), readToken(reader)]) };
    throw new Error(`Unknown binary topology node kind: ${kind}`);
  });
  const root = readToken(reader);
  if (reader.offset !== reader.buffer.length) throw new Error("Unexpected trailing data in binary topology payload.");
  const value = decodeTopologyLayers({ stringPool: strings, topology: nodes }, root).value;
  const actual = sha256(value);
  return {
    value,
    integrity: { expected: sourceHash, actual, ok: sourceHash === actual },
    topology: { stringPool: strings, topology: nodes, root }
  };
}

export function createPiTopologyFixture(count = 180) {
  const commonContext = {
    workspace: "Dock",
    source: "map-learning",
    policy: { observeBeforeAct: true, retainEvidence: true }
  };
  const commonRecipe = { kind: "resume-recipe", executesAutomatically: false, version: 1 };
  return {
    schema: "state-capsule-benchmark-fixture-v0",
    objects: Array.from({ length: count }, (_, index) => ({
      id: `task-${String(index + 1).padStart(4, "0")}`,
      type: "paused-task",
      state: {
        goal: "compare public map sources",
        progress: (index * 7) % 100,
        nextStep: index % 3 === 0 ? "inspect map result" : "compare evidence",
        evidence: index % 5 === 0 ? ["map page ready", "result needs observation"] : ["map page ready"]
      },
      context: commonContext,
      dependencies: ["browser-hand", "world-map"],
      restoreRecipe: commonRecipe,
      relations: [{ type: "continues-after", targetId: `task-${String(Math.max(1, index)).padStart(4, "0")}` }]
    }))
  };
}
