import React from "react";
import { Link, useParams } from "react-router-dom";
import { Button } from "@blueprintjs/core";
import KeyBoard from "./KeyBoard";
import MatchKeyMappingDisplay from "./MatchedKeyMapping";
import { MODIFIERS } from "../utils/keyFunctions";
import { parseVimKeyMappings, matchKeyPressMappings, mappingModes } from "../utils/keyMatching";
import { useWorkspace } from "../Workspace";
import builtinMappings from "../data/builtinMappings.json";
import PressedKeys from "./PressedKeys";
import KeyMappingDetail from "./KeyMappingDetail";
import TmuxPrefix from "./TmuxPrefix";
import { getTmuxPrefixes } from "../utils/tmuxPrefixes";
import "./DesignPage.css";
import { displaySourceLabel } from "../utils/sourceLabel";

const builtinProfile = { id: "builtin", name: "Vim built-ins", kind: "vim", mappings: [], sourceLabel: "Vim 9.0 reference", warnings: [] };

export default function DesignPage() {
  const { profileId } = useParams();
  const { workspace, error: workspaceError } = useWorkspace();
  const profile = profileId === "builtin" ? builtinProfile : workspace?.profiles.find((p) => p.id === profileId);
  const problem = (profileId !== "builtin" && workspaceError) || (workspace && profileId && !profile && "This snapshot could not be found.");
  if (problem) return <main className="design-page"><header className="review-header window-drag"><Link to="/">← Workspace</Link></header><p className="workspace-error" role="alert">{problem}</p></main>;
  if (!profile) return <main className="design-page"><header className="review-header window-drag"><Link to="/">← Workspace</Link></header><p>Loading mappings…</p></main>;
  return <MappingViewer key={profile.id} profile={profile} />;
}

export function MappingViewer({ profile }) {
  const allKeyMaps = React.useMemo(() => parseVimKeyMappings(profile.kind === "vim" ? profile.mappings.concat(builtinMappings) : profile.mappings), [profile]);
  const prefixes = React.useMemo(() => profile.kind === "tmux" ? getTmuxPrefixes(profile) : [], [profile]);
  const [currentPressed, setCurrentPressed] = React.useState(null);
  const [pressedEvents, setPressedEvents] = React.useState([]);
  const [captureKeys, setCaptureKeys] = React.useState(true);
  const [showKeyMap, setShowKeyMap] = React.useState(null);
  const [searchKeywords, setSearchKeywords] = React.useState("");
  const [sources, setSources] = React.useState(() => Object.fromEntries([...new Set(allKeyMaps.map((k) => k.setting_source || "unknown"))].map((source) => [source, source !== "builtin" || profile.mappings.length === 0])));
  const [mode, setMode] = React.useState(() => Object.fromEntries((profile.kind === "vim" ? ["n", "i", "v", "s", "x", "c", "o", "t", "l"] : [...new Set(allKeyMaps.map((k) => k.table))]).map((m) => [m, true])));

  React.useEffect(() => {
    if (!captureKeys || showKeyMap) return;
    const handleKeyDown = (event) => {
      if (event.isComposing || event.repeat || event.target.closest?.("input, textarea, select, button, a, [contenteditable='true']")) return;
      if (event.key === "Backspace" && !event.ctrlKey && !event.altKey && !event.metaKey && !event.shiftKey) {
        event.preventDefault();
        setPressedEvents([]);
        setCurrentPressed(null);
        return;
      }
      setCurrentPressed(event);
      if (MODIFIERS.includes(event.key)) return;
      event.preventDefault();
      setPressedEvents((previous) => [...previous, { key: event.key, code: event.code, shiftKey: event.shiftKey, ctrlKey: event.ctrlKey, altKey: event.altKey, metaKey: event.metaKey }]);
      setCurrentPressed(null);
    };
    const clearHeld = () => setCurrentPressed(null);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", clearHeld);
    window.addEventListener("blur", clearHeld);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", clearHeld);
      window.removeEventListener("blur", clearHeld);
    };
  }, [captureKeys, showKeyMap]);

  const matched = React.useMemo(() => {
    const query = searchKeywords.trim().toLowerCase();
    return allKeyMaps.filter((mapping) => sources[mapping.setting_source || "unknown"] && mappingModes(mapping).some((m) => mode[m]))
      .filter((mapping) => !query || [mapping.lhs, mapping.rhs, mapping.verbose].some((field) => (field || "").toLowerCase().includes(query)))
      .filter((mapping) => matchKeyPressMappings(pressedEvents, mapping))
      .map((mapping) => ({ ...mapping, nextExpect: mapping.jsKeys[pressedEvents.length] }));
  }, [allKeyMaps, sources, mode, searchKeywords, pressedEvents]);

  const clearKeys = (event) => { setPressedEvents([]); setCurrentPressed(null); event.currentTarget.blur(); };
  return <main className="design-page">
    <header className="review-header window-drag"><Link to="/">← Workspace</Link><div className="grow"><h1>{profile.name}</h1><p>{displaySourceLabel(profile.sourceLabel)}</p></div><Button active={captureKeys} onClick={(e) => { setCaptureKeys(!captureKeys); setCurrentPressed(null); e.currentTarget.blur(); }}>{captureKeys ? "Keyboard capture on" : "Keyboard capture off"}</Button></header>
    {profile.warnings?.length > 0 && <details className="import-warnings"><summary>Import notes ({profile.warnings.length}) — some mappings may be missing</summary><ul>{profile.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul></details>}
    {profile.kind === "tmux" && <TmuxPrefix prefixes={prefixes} pressedEvents={pressedEvents} captureKeys={captureKeys} tableEnabled={mode.prefix} />}
    <PressedKeys pressed={pressedEvents} currentPressed={currentPressed} handleClearKey={clearKeys} />
    <MatchKeyMappingDisplay matchedKeyMappings={matched} sources={sources} setSources={setSources} mode={mode} setMode={setMode} searchKeywords={searchKeywords} setSearchKeywords={setSearchKeywords} setShowKeyMap={setShowKeyMap} />
    <KeyBoard matchedKeyMappings={matched} currentPressed={currentPressed} prefixKeys={mode.prefix && pressedEvents.length === 0 ? prefixes.flatMap((prefix) => prefix.physicalKeys) : []} />
    <KeyMappingDetail showKeyMap={showKeyMap} setShowKeyMap={setShowKeyMap} />
  </main>;
}
