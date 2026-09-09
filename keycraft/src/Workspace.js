import React from "react";

const WorkspaceContext = React.createContext(null);
const storageKey = "keycraft.workspace.v1";
export const isDesktop = Boolean(window.keymapDesktop);

export function WorkspaceProvider({ children }) {
  const [workspace, setWorkspace] = React.useState(null);
  const [error, setError] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const currentWorkspace = React.useRef(null);
  const pending = React.useRef(false);
  React.useEffect(() => {
    let active = true;
    Promise.resolve().then(() => isDesktop ? window.keymapDesktop.loadWorkspace() : JSON.parse(localStorage.getItem(storageKey) || '{"version":1,"profiles":[]}'))
      .then((data) => {
        if (data?.version !== 1 || !Array.isArray(data.profiles)) throw new Error("Unrecognized saved workspace.");
        if (active) { currentWorkspace.current = data; setWorkspace(data); }
      }).catch((e) => { if (active) setError(e.message); });
    return () => { active = false; };
  }, []);

  const updateWorkspace = async (transform) => {
    if (!currentWorkspace.current || pending.current) throw new Error("Workspace is not ready.");
    const next = transform(currentWorkspace.current);
    pending.current = true;
    setSaving(true);
    try {
      if (isDesktop) await window.keymapDesktop.saveWorkspace(next);
      else localStorage.setItem(storageKey, JSON.stringify(next));
      currentWorkspace.current = next;
      setWorkspace(next);
    } finally { pending.current = false; setSaving(false); }
  };
  const addProfile = async (profile) => {
    const record = { ...profile, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
    await updateWorkspace((current) => ({ ...current, profiles: [record, ...current.profiles] }));
    return record;
  };
  const deleteProfile = (id) => updateWorkspace((current) => ({ ...current, profiles: current.profiles.filter((profile) => profile.id !== id) }));
  const clearProfiles = () => updateWorkspace(() => ({ version: 1, profiles: [] }));
  const setVimLeader = (id, vimLeader) => updateWorkspace((current) => ({ ...current,
    profiles: current.profiles.map((profile) => profile.id === id && profile.kind === "vim" ? { ...profile, vimLeader } : profile),
  }));
  return <WorkspaceContext.Provider value={{ workspace, error, saving, addProfile, deleteProfile, clearProfiles, setVimLeader }}>{children}</WorkspaceContext.Provider>;
}

export const useWorkspace = () => React.useContext(WorkspaceContext);
