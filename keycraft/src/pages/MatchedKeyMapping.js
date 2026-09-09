import { InputGroup, Card, Elevation, Tag } from "@blueprintjs/core";
import { modeColors } from "./const";
import { mappingPrefix, describeKey } from "../utils/tmuxPrefixes";
import "./MatchedKeyMapping.css";

export default function MatchKeyMappingDisplay({ matchedKeyMappings, sources, setSources, mode, setMode, searchKeywords, setSearchKeywords, setShowKeyMap }) {
  return <section className="key-mapping-container" aria-label="Mapping results">
    <div className="filter-row-box">
      <div className="source-filter-box"><span>source</span>{Object.entries(sources).map(([source, selected]) => <button key={source} className={`filter-chip ${selected ? "selected" : ""}`} aria-pressed={selected} onClick={(e) => { setSources({ ...sources, [source]: !selected }); e.currentTarget.blur(); }}>{source}</button>)}</div>
      <InputGroup aria-label="Search mappings" value={searchKeywords} onChange={(e) => setSearchKeywords(e.target.value)} placeholder="Search keys, commands, or source…" leftIcon="search" />
    </div>
    <div className="mode-filter-box"><span>{mode.prefix !== undefined ? "table" : "mode"}</span>{Object.entries(mode).map(([key, selected]) => <button key={key} className={`filter-chip ${selected ? "selected" : ""}`} aria-pressed={selected} onClick={(e) => { setMode({ ...mode, [key]: !selected }); e.currentTarget.blur(); }}>{key}</button>)}<span className="mapping-count-info" role="status">{matchedKeyMappings.length} mappings</span></div>
    <Card elevation={Elevation.ZERO} className="key-mapping-card">
      {matchedKeyMappings.length ? matchedKeyMappings.map((mapping, index) => <button key={index} className="one-key-mapping" onClick={(e) => { setShowKeyMap(mapping); e.currentTarget.blur(); }}>
        <span className="settings-source-col">{mapping.setting_source || "unknown"}</span>
        <span className="mapping-modes">{(mapping.table ? [mapping.table] : (mapping.cmd?.trim() || "nvo").split("")).map((letter) => <Tag key={letter} minimal style={{ color: modeColors[letter] || "#586b4d" }}>{letter}</Tag>)}</span>
        <MappingKeys mapping={mapping} /><span className="mapping-rhs">{mapping.rhs}</span><span className="mapping-detail-arrow">↗</span>
      </button>) : <div className="no-mappings-message">No mappings match. Clear the key sequence or adjust your filters.</div>}
    </Card>
  </section>;
}

function MappingKeys({ mapping }) {
  const prefix = mappingPrefix(mapping);
  if (!prefix) return <code>{mapping.lhs}</code>;
  return <span className="tmux-mapping-keys" title={mapping.lhs}>
    <span className="mapping-prefix-badge"><small>PREFIX</small><kbd>{describeKey(prefix).label}</kbd></span>
    <span className="mapping-key-separator" aria-label="then">→</span>
    <code>{mapping.bindingKey || mapping.lhs.slice(prefix.length)}</code>
  </span>;
}
