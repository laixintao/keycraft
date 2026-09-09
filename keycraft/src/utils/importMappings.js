import stringWidth from "string-width";

const cleanMapping = (mapping) => ({
  cmd: "", attr: "", verbose: "", raw: "", tag: "", setting_source: "unknown", ...mapping,
});

function sourceOf(filename) {
  if (/(^|[/\\])(\.vimrc|vimrc|_vimrc|init\.vim|init\.lua)$/.test(filename)) return "vimrc";
  return filename ? "plugin" : "unknown";
}

function maplistKeyNotation(mapping) {
  // Native exports use keytrans() before raw Vim keycodes cross JSON.
  if (typeof mapping.lhsNotation === "string") return mapping.lhsNotation;
  // Plain printable lhsraw also disambiguates older maplist exports.
  const raw = mapping.lhsraw;
  const printable = typeof raw === "string" && Array.from(raw).every((char) => {
    const code = char.codePointAt(0);
    return code >= 32 && (code < 127 || code > 159) && code !== 0xfffd;
  });
  return printable ? raw.replace(/</g, "<lt>") : undefined;
}

export function parseVimMaplist(text) {
  const data = JSON.parse(text);
  if (!Array.isArray(data.mappings) || !Array.isArray(data.scripts)) throw new Error("Invalid Vim export.");
  const scripts = Object.fromEntries(data.scripts.map((s) => [s.sid, s.name]));
  return data.mappings.map((m) => {
    const filename = scripts[m.sid] || "";
    if (typeof m.lhs !== "string" || typeof m.rhs !== "string") throw new Error("Invalid Vim mapping.");
    return cleanMapping({
      cmd: m.mode, lhs: m.lhs, rhs: m.rhs,
      lhsNotation: maplistKeyNotation(m),
      attr: [m.noremap && "noremap", m.silent && "silent", m.expr && "expr", m.buffer && "buffer"].filter(Boolean).join(" "),
      setting_source: sourceOf(filename),
      verbose: filename ? `${filename}:${m.lnum || 0}` : "Source unavailable",
      raw: `${m.mode || ""} ${m.lhs} ${m.rhs}`,
    });
  });
}

export function parseVimVerbose(text) {
  const start = text.lastIndexOf("sK7gstart");
  if (start !== -1) {
    const end = text.indexOf("aYx9end", start);
    if (end === -1) throw new Error("The Vim export is incomplete (missing end marker).");
    text = text.slice(start + "sK7gstart".length, end);
  }
  const mappings = [];
  const warnings = [];
  let previous = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw;
    if (!line.trim() || /^No mapping found/.test(line.trim())) { previous = null; continue; }
    if (/^\s*Last set /.test(line)) {
      if (previous) {
        previous.verbose = line.trim();
        previous.setting_source = sourceOf(line.trim().replace(/^Last set from /, "").replace(/ line \d+$/, ""));
      }
      previous = null;
      continue;
    }
    previous = null;
    const match = line.match(/^([nvxsoictl!]+| ) +(\S+)( +.*)$/);
    if (!match) { warnings.push(`Unrecognized line: ${line}`); continue; }
    // Vim pads the LHS to 12 display cells (or adds one space for long
    // sequences), then writes exactly two columns: remap flag and local flag.
    const padding = Math.max(1, 12 - stringWidth(match[2]));
    let body = /^ +$/.test(match[3].slice(0, padding))
      ? match[3].slice(padding).match(/^([*& ][@ ])(.*)$/) : null;
    // Keep accepting older pasted examples with shortened padding, but only
    // when a nonblank remap flag makes the two attribute columns explicit.
    if (!body && match[3].search(/\S/) < padding) body = match[3].match(/^ +([*&][@ ])(.*)$/);
    if (!body) { warnings.push(`Unrecognized line: ${line}`); continue; }
    previous = cleanMapping({ cmd: match[1].trim(), lhs: match[2], attr: body[1].trim(), rhs: body[2], raw });
    mappings.push(previous);
  }
  if (!mappings.length && !/No mapping found/.test(text)) throw new Error("No Vim mappings found. Paste the output of :verbose map and :verbose map!, rather than vimrc source code.");
  return { mappings, warnings };
}

// tmux list-keys quotes keys such as '"', '\\' and ';'. Only tokenize the
// bind-key header; leave the command body intact (it may contain shell syntax).
function tokens(line) {
  const result = [];
  let index = 0;
  while (index < line.length) {
    while (/\s/.test(line[index] || "") && index < line.length) index++;
    if (index === line.length) break;
    let value = "", quote = null;
    const start = index;
    while (index < line.length) {
      const char = line[index++];
      if (!quote && /\s/.test(char)) break;
      if (char === "\\" && quote !== "'") {
        if (index < line.length) value += line[index++];
      } else if (quote === char) quote = null;
      else if (!quote && (char === "'" || char === '"')) quote = char;
      else value += char;
    }
    result.push({ value, start });
  }
  return result;
}

export function tmuxKeyNotation(key) {
  const modifiers = [];
  while (/^[CMS]-/.test(key)) { modifiers.push(key[0]); key = key.slice(2); }
  const special = { BSpace: "BS", DC: "Del", PPage: "PageUp", NPage: "PageDown", Escape: "Esc", Enter: "CR", Space: "Space", Tab: "Tab", BTab: "Tab" };
  if (key === "BTab") modifiers.push("S");
  if (key === "<") key = "lt";
  if (key === "|") key = "bar";
  const base = special[key] || key;
  return modifiers.length || base.length > 1 ? `<${[...modifiers, base].join("-")}>` : base;
}

export function parseTmuxList(text, prefix = "C-b", prefix2 = "None") {
  const mappings = [], warnings = [];
  for (const raw of text.split(/\r?\n/)) {
    if (!raw.trim() || raw.trim().startsWith("#")) continue;
    const parts = tokens(raw);
    if (!["bind", "bind-key"].includes(parts[0]?.value)) { warnings.push(`Unrecognized line: ${raw}`); continue; }
    let table = "prefix", index = 1, repeat = false;
    while (parts[index]?.value.startsWith("-") && parts[index].value !== "-") {
      const option = parts[index++].value;
      if (option === "--") break;
      if (option === "-T") table = parts[index++]?.value;
      else if (option === "-n") table = "root";
      else if (option === "-r") repeat = true;
      else if (option === "-N") index++;
      else { table = null; break; }
    }
    const key = parts[index++]?.value;
    const command = parts[index] && raw.slice(parts[index].start);
    if (!table || !key || !command) { warnings.push(`Unsupported binding: ${raw}`); continue; }
    const prefixes = table === "prefix" ? [...new Set([prefix, prefix2].filter((p) => p && p !== "None"))] : [""];
    for (const p of prefixes) {
      const notation = `${p ? tmuxKeyNotation(p) : ""}${tmuxKeyNotation(key)}`;
      mappings.push(cleanMapping({
        cmd: table, table, lhs: notation, rhs: command, raw,
        prefix: p, bindingKey: tmuxKeyNotation(key),
        setting_source: "tmux", attr: repeat ? "repeat" : "",
        verbose: `tmux key table: ${table}${p ? ` · prefix: ${p}` : ""}`,
      }));
    }
  }
  if (!mappings.length) throw new Error("No tmux bindings found. Paste the output of tmux list-keys.");
  return { mappings, warnings };
}

export function parseImport(payload) {
  if (payload.format === "vim-maplist") return { mappings: parseVimMaplist(payload.text), warnings: payload.warnings || [] };
  return payload.kind === "tmux" ? parseTmuxList(payload.text, payload.prefix, payload.prefix2) : parseVimVerbose(payload.text);
}
