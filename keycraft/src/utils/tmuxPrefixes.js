import { tmuxKeyNotation } from "./importMappings";
import { parseVimKeyMappings } from "./keyMatching";
import { describeKeyPress } from "./keyDescription";

export function mappingPrefix(mapping) {
  if (mapping.table !== "prefix") return null;
  // Older snapshots kept the prefix in the source description only.
  const raw = mapping.prefix || mapping.verbose?.match(/ · prefix: (.+)$/)?.[1];
  const notation = raw ? tmuxKeyNotation(raw) : mapping.lhs.match(/^<[^>]+>|[\s\S]/)?.[0];
  return notation || null;
}

export function describeKey(notation) {
  const key = parseVimKeyMappings([{ lhs: notation, rhs: "" }])[0]?.jsKeys[0];
  if (!key) return { notation, label: notation, physicalKeys: [] };
  return { notation, ...describeKeyPress(key) };
}

export function getTmuxPrefixes(profile) {
  const notations = Array.isArray(profile.tmuxPrefixes)
    ? profile.tmuxPrefixes.map(tmuxKeyNotation)
    : profile.mappings.map(mappingPrefix).filter(Boolean);
  return [...new Set(notations)].map(describeKey);
}
