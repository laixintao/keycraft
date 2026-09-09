import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { Dialog, Icon } from "@blueprintjs/core";
import { isDesktop, useWorkspace } from "../Workspace";
import { displaySourceLabel } from "../utils/sourceLabel";
import { parseImport } from "../utils/importMappings";
import "./Home.css";

export default function Home() {
  const { workspace, error: loadError, saving, addProfile, deleteProfile, clearProfiles } = useWorkspace();
  const navigate = useNavigate();
  const [busy, setBusy] = React.useState("");
  const [error, setError] = React.useState("");
  const [paste, setPaste] = React.useState(false);
  const [kind, setKind] = React.useState("vim");
  const [name, setName] = React.useState("");
  const [raw, setRaw] = React.useState("");
  const [prefix, setPrefix] = React.useState("C-b");
  const [prefix2, setPrefix2] = React.useState("None");
  const [leader, setLeader] = React.useState("");
  const [scope, setScope] = React.useState("all");
  const [query, setQuery] = React.useState("");
  const [deleteTarget, setDeleteTarget] = React.useState(null);
  const [deleteError, setDeleteError] = React.useState("");
  const listRef = React.useRef(null);
  const deleted = React.useRef(false);
  const disabled = Boolean(busy || saving || !workspace);
  const profiles = workspace?.profiles || [];
  const visibleProfiles = profiles.filter((profile) => (scope === "all" || profile.kind === scope)
    && [profile.name, displaySourceLabel(profile.sourceLabel), profile.kind].some((value) => value?.toLowerCase().includes(query.trim().toLowerCase())));
  const openImport = (source = "vim") => { setKind(source); setError(""); setPaste(true); };
  const requestDelete = (target) => { setDeleteError(""); deleted.current = false; setDeleteTarget(target); };
  const confirmDelete = async () => {
    setDeleteError("");
    try {
      if (deleteTarget.all) await clearProfiles();
      else await deleteProfile(deleteTarget.id);
      setRaw("");
      setError("");
      deleted.current = true;
      setDeleteTarget(null);
    } catch (e) { setDeleteError(`Could not delete snapshots: ${e.message}`); }
  };

  const saveImport = async (payload, label) => {
    const { mappings, warnings, vimLeader } = parseImport(payload);
    const tmuxMetadata = payload.kind === "tmux" ? { tmuxPrefixes: [...new Set([payload.prefix ?? "C-b", payload.prefix2].filter((key) => key && key !== "None"))] } : {};
    const profile = await addProfile({ name: label, kind: payload.kind, mappings, warnings, sourceLabel: payload.sourceLabel || "Text import", ...tmuxMetadata, ...(vimLeader ? { vimLeader } : {}) });
    navigate(`/snapshots/${profile.id}`);
  };
  const importFromApp = async (source) => {
    setBusy(source); setError("");
    try {
      const payload = await window.keymapDesktop.importMappings(source);
      await saveImport(payload, `${source === "vim" ? "Vim" : "tmux"} · ${new Date().toLocaleString()}`);
    } catch (e) { setError(e.message); }
    finally { setBusy(""); }
  };
  const importText = async (event) => {
    event.preventDefault(); setBusy("text"); setError("");
    try { await saveImport({ kind, text: raw, prefix, prefix2, vimLeader: leader }, name.trim() || `${kind} · Text import`); }
    catch (e) { setError(e.message); }
    finally { setBusy(""); }
  };

  return <main className="home-page">
    <aside className="workspace-sidebar" aria-label="Workspace sidebar">
      <div className="sidebar-titlebar window-drag" />
      <div className="home-brand"><span className="brand-mark" aria-hidden="true">⌘</span><span>keycraft</span></div>
      <nav className="workspace-nav" aria-label="Snapshot library">
        <p className="sidebar-label">Library</p>
        {[
          { id: "all", label: "All snapshots", icon: "layers" },
          { id: "vim", label: "Vim", icon: "console" },
          { id: "tmux", label: "tmux", icon: "panel-table" },
        ].map((item) => <button key={item.id} className={`sidebar-item${scope === item.id ? " selected" : ""}`} aria-label={item.id === "all" ? item.label : `${item.label} snapshots`} aria-pressed={scope === item.id} onClick={() => setScope(item.id)}>
          <Icon icon={item.icon} size={16} /><span className="grow">{item.label}</span><span className="sidebar-count">{item.id === "all" ? profiles.length : profiles.filter((p) => p.kind === item.id).length}</span>
        </button>)}
        <p className="sidebar-label reference-label">Reference</p>
        <Link className="sidebar-item" to="/snapshots/builtin" aria-label="Explore Vim built-ins"><Icon icon="book" size={16} /><span>Vim built-ins</span></Link>
      </nav>
    </aside>
    <div className="workspace-main">
      <header className="workspace-toolbar window-drag"><h1>Workspace</h1><button className="secondary-action" disabled={disabled} onClick={() => openImport()}><Icon icon="import" size={14} />Import text or file</button></header>
      <div className="home-content">
        {(loadError || (error && !paste)) && <div className="workspace-error" role="alert">{loadError || error}</div>}
        <section className="import-grid" aria-label="Import mappings">
          <article className="import-card"><div className="import-card-heading"><span className="tool-symbol" aria-hidden="true">V_</span><div><h2>Vim</h2><p>Your mappings and plugins</p></div></div>
            <p className="import-description">{isDesktop ? "Import using your vimrc and loaded plugins." : "Paste an export of your Vim mappings."}</p>
            <div className="import-actions">{isDesktop && <button className="primary-action" disabled={disabled} onClick={() => importFromApp("vim")}>{busy === "vim" ? "Reading Vim…" : "Import from Vim"}</button>}<button className="secondary-action" disabled={disabled} onClick={() => openImport("vim")}>Paste Vim mappings <span>→</span></button></div>
          </article>
          <article className="import-card"><div className="import-card-heading"><span className="tool-symbol" aria-hidden="true">[_]</span><div><h2>tmux</h2><p>Prefix keys and key tables</p></div></div>
            <p className="import-description">{isDesktop ? "Read bindings from your active tmux server." : "Paste an export of your tmux bindings."}</p>
            <div className="import-actions">{isDesktop && <button className="primary-action" disabled={disabled} onClick={() => importFromApp("tmux")}>{busy === "tmux" ? "Reading tmux…" : "Import from tmux"}</button>}<button className="secondary-action" disabled={disabled} onClick={() => openImport("tmux")}>Paste tmux bindings <span>→</span></button></div>
          </article>
        </section>
        <section className="snapshots" aria-label="Saved snapshots">
          <div className="section-label"><h2>{scope === "all" ? "Your snapshots" : `${scope === "vim" ? "Vim" : "tmux"} snapshots`}<span className="snapshot-total">{visibleProfiles.length}</span></h2><label className="snapshot-search"><Icon icon="search" size={14} /><input type="search" aria-label="Search snapshots" placeholder="Filter snapshots" value={query} onChange={(e) => setQuery(e.target.value)} /></label></div>
          <div className="snapshot-columns" aria-hidden="true"><span>Snapshot</span><span>Mappings</span></div>
          <div ref={listRef} className="snapshot-list" role="region" aria-label="Snapshot list" tabIndex={0}>
            {!workspace && !loadError ? <div className="empty-snapshots">Loading your workspace…</div> : visibleProfiles.length ? visibleProfiles.map((profile) => <div key={profile.id} className="snapshot-row"><Link to={`/snapshots/${profile.id}`} className="snapshot"><span className="snapshot-kind">{profile.kind}</span><span className="grow"><strong>{profile.name}</strong><small>{displaySourceLabel(profile.sourceLabel)} · {new Date(profile.createdAt).toLocaleString()}</small></span><span className="snapshot-mapping-count">{profile.mappings.length}</span><Icon icon="chevron-right" size={14} /></Link><button className="delete-snapshot" aria-label={`Delete snapshot ${profile.name}`} title="Delete snapshot" disabled={disabled} onClick={() => requestDelete(profile)}><Icon icon="trash" size={14} /></button></div>) : <div className="empty-snapshots"><Icon icon={profiles.length ? "search" : "layers"} size={28} /><strong>{profiles.length ? "No matching snapshots" : "No snapshots yet"}</strong><span>{profiles.length ? "Try another search or choose a different library." : "Import your Vim or tmux mappings to start a review."}</span></div>}
          </div>
          <footer className="library-footer"><span>{profiles.length} saved {profiles.length === 1 ? "snapshot" : "snapshots"}</span><button className="clear-snapshots" disabled={disabled || !profiles.length} onClick={() => requestDelete({ all: true })}>Clear all snapshots</button></footer>
        </section>
      </div>
    </div>
    <Dialog className="delete-dialog" title={deleteTarget?.all ? "Clear all snapshots?" : "Delete snapshot?"} isOpen={Boolean(deleteTarget)} isCloseButtonShown={!saving} canEscapeKeyClose={!saving} canOutsideClickClose={!saving} onClose={() => { if (!saving) setDeleteTarget(null); }} onClosed={() => { if (deleted.current) listRef.current?.focus(); }}>
      <div className="delete-dialog-body">
        <p>{deleteTarget?.all ? `Delete all ${profiles.length} saved snapshots, including those hidden by filters?` : <>Delete “{deleteTarget?.name}”?</>}</p>
        <p>This cannot be undone. Your Vim and tmux configuration and the bundled reference will be kept.</p>
        {deleteError && <div className="workspace-error" role="alert">{deleteError}</div>}
      </div>
      <div className="import-form-footer"><button type="button" className="secondary-action" autoFocus disabled={saving} onClick={() => setDeleteTarget(null)}>Cancel</button><button type="button" className="primary-action danger-action" disabled={saving} onClick={confirmDelete}>{saving ? "Deleting…" : deleteTarget?.all ? "Delete all snapshots" : "Delete snapshot"}</button></div>
    </Dialog>
    <Dialog className="import-dialog" title="Import an exported keymap" isOpen={paste} onClose={() => setPaste(false)}>
      <form className="paste-panel" onSubmit={importText}>
        <div className="import-form-body">
          {error && <div className="workspace-error" role="alert">{error}</div>}
          <div className="form-row"><label>Application<select value={kind} onChange={(e) => setKind(e.target.value)}><option value="vim">Vim</option><option value="tmux">tmux</option></select></label><label className="grow">Snapshot name<input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. My everyday setup" /></label></div>
          {kind === "tmux" ? <><p>Paste <code>tmux list-keys</code> output. Set prefixes to match <code>tmux show-options -gv prefix</code> and <code>prefix2</code>.</p><div className="form-row"><label>Prefix<input value={prefix} required onChange={(e) => setPrefix(e.target.value)} /></label><label>Second prefix<input value={prefix2} onChange={(e) => setPrefix2(e.target.value)} /></label></div></> : <p>In Vim, run <code>:redir @+</code>, <code>:silent verbose map</code>, <code>:silent verbose map!</code>, then <code>:redir END</code>. Paste the result below. You can also export a text file with <code>:redir! &gt; mappings.txt</code>.</p>}
          <label>Exported mappings<textarea value={raw} onChange={(e) => setRaw(e.target.value)} required rows={8} spellCheck={false} /></label>
          {kind === "vim" && <><label>Leader key (optional)<input value={leader} onChange={(e) => setLeader(e.target.value)} placeholder="e.g. <Space> or ," spellCheck={false} aria-describedby="vim-leader-help" /></label><small id="vim-leader-help">Enter your leader as a character or Vim key notation, such as &lt;Space&gt;.</small></>}
          <label className="file-label">Load text file<input type="file" accept=".txt,.log,text/plain" disabled={disabled} onChange={async (e) => { const file = e.target.files[0]; if (!file) return; try { if (file.size > 10 * 1024 * 1024) throw new Error("Please use an export smaller than 10 MB."); setRaw(await file.text()); } catch (err) { setError(err.message); } }} /></label>
        </div>
        <div className="import-form-footer"><button type="button" className="secondary-action" onClick={() => setPaste(false)}>Cancel</button><button type="submit" className="primary-action" disabled={disabled || !raw.trim()}>{busy === "text" ? "Saving…" : "Save and explore →"}</button></div>
      </form>
    </Dialog>
  </main>;
}
