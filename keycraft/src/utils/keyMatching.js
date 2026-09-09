import { VIMKEY2JSKEY } from "./keyFunctions";

function keyPress(key) {
  return { key, needShift: false, needMeta: false, needAlt: false, needControl: false };
}

function combinedKey(value, explicitNotation) {
  const result = keyPress("");
  while (/^[CASMDT]-/i.test(value)) {
    const modifier = value[0].toUpperCase();
    if (modifier === "C") result.needControl = true;
    if (modifier === "A" || modifier === "M") result.needAlt = true;
    if (modifier === "S") result.needShift = true;
    if (modifier === "D" || modifier === "T") result.needMeta = true;
    value = value.slice(2);
  }
  const special = Object.keys(VIMKEY2JSKEY).find((k) => k.toLowerCase() === value.toLowerCase());
  const functionKey = /^F([1-9]|[12]\d|3[0-7])$/i.test(value);
  const modifiedCharacter = value.length === 1 && (result.needControl || result.needAlt || result.needShift || result.needMeta);
  if (!special && !functionKey && !modifiedCharacter && !explicitNotation) return null;
  result.key = special ? VIMKEY2JSKEY[special] : functionKey ? value.toUpperCase() : value;
  if (result.key.length === 1 && result.needControl) result.key = result.key.toLowerCase();
  if (result.key.length === 1 && result.needShift) result.key = result.key.toUpperCase();
  return result;
}

export function parseVimKeyMappings(mappings) {
  return mappings.filter((m) => !/^<(Plug|SNR)>/i.test(m.lhsNotation ?? m.lhs)).map((mapping) => {
    const lhs = mapping.lhsNotation ?? mapping.lhs;
    const notation = mapping.setting_source === "builtin" ? lhs.replace(/\{[^}]*\}/g, "") : lhs;
    // Canonical exports escape literal '<'. Unsupported special keys in them
    // (for example mouse keys) must not become printable text sequences.
    const explicitNotation = typeof mapping.lhsNotation === "string" || mapping.setting_source === "builtin" || Boolean(mapping.table);
    const jsKeys = (notation.match(/<[^<>]+>|[\s\S]/gu) || []).flatMap((key) => {
      const special = key.startsWith("<") && key.length > 1 ? combinedKey(key.slice(1, -1), explicitNotation) : null;
      return special ? [special] : Array.from(key, keyPress);
    });
    return { ...mapping, jsKeys, nextExpect: jsKeys[0] };
  }).filter((m) => m.jsKeys.length);
}

const printableCodes = {
  Backquote: "`~", Minus: "-_", Equal: "=+", BracketLeft: "[{", BracketRight: "]}",
  Backslash: "\\|", Semicolon: ";:", Quote: "'\"", Comma: ",<", Period: ".>", Slash: "/?",
};

function optionKey(event) {
  if (/^Key[A-Z]$/.test(event.code)) return event.shiftKey ? event.code.slice(3) : event.code.slice(3).toLowerCase();
  if (/^Digit[0-9]$/.test(event.code)) return event.shiftKey ? ")!@#$%^&*("[Number(event.code.slice(5))] : event.code.slice(5);
  return printableCodes[event.code]?.[event.shiftKey ? 1 : 0] ?? event.key;
}

export function matchOneKey(event, expected) {
  // macOS Option can produce symbols or dead keys instead of the key's
  // printable identity. Recover it from code while preserving modifiers.
  let actual = event.altKey ? optionKey(event) : event.key;
  if (expected.needControl && actual.length === 1) actual = actual.toLowerCase();
  const target = expected.needControl && expected.key.length === 1 ? expected.key.toLowerCase() : expected.key;
  if (target.length > 1 ? target !== event.code : target !== actual) return false;
  if (expected.needControl !== event.ctrlKey || expected.needAlt !== event.altKey || expected.needMeta !== event.metaKey) return false;
  // Shift is already encoded in printable characters. Special keys and Ctrl
  // combinations must distinguish their explicit Shift modifier.
  if ((target.length > 1 || expected.needControl) && expected.needShift !== event.shiftKey) return false;
  if (expected.needShift && !event.shiftKey) return false;
  return true;
}

export function matchKeyPressMappings(events, mapping) {
  return events.length <= mapping.jsKeys.length && events.every((event, index) => matchOneKey(event, mapping.jsKeys[index]));
}

export function mappingModes(mapping) {
  if (mapping.table) return [mapping.table];
  const mode = (mapping.cmd || "").trim();
  if (!mode) return ["n", "x", "s", "o"];
  if (mode === "!") return ["i", "c"];
  return [...new Set(mode.split("").flatMap((m) => m === "v" ? ["v", "x", "s"] : [m]))];
}
