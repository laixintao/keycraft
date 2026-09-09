import { tmuxKeyNotation } from "./importMappings";
import { parseVimKeyMappings } from "./keyMatching";

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
  const names = { " ": "Space", ArrowLeft: "←", ArrowRight: "→", ArrowUp: "↑", ArrowDown: "↓", Escape: "Esc" };
  const modifiers = [key.needControl && "Ctrl", key.needAlt && "Alt", key.needShift && "Shift", key.needMeta && "⌘"].filter(Boolean);
  const label = [...modifiers, names[key.key] || (/^[a-z]$/i.test(key.key) ? key.key.toUpperCase() : key.key)].join(" + ");
  const physicalKeys = [
    key.needControl && "Control", key.needAlt && "Alt", key.needMeta && "Meta",
    (key.needShift || /^[A-Z~!@#$%^&*()_+{}|:"<>?]$/.test(key.key)) && "Shift",
    key.key === " " ? "Space" : key.key.length === 1 ? key.key.toLowerCase() : key.key,
  ].filter(Boolean);
  return { notation, label, key, physicalKeys };
}

export function getTmuxPrefixes(profile) {
  const notations = Array.isArray(profile.tmuxPrefixes)
    ? profile.tmuxPrefixes.map(tmuxKeyNotation)
    : profile.mappings.map(mappingPrefix).filter(Boolean);
  return [...new Set(notations)].map(describeKey);
}
