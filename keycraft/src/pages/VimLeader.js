import React from "react";
import { describeVimLeader } from "../utils/vimLeader";
import "./VimLeader.css";

export default function VimLeader({ leader, received, pressedEvents, captureKeys, onSave, saving }) {
  const [editing, setEditing] = React.useState(false);
  const [value, setValue] = React.useState("");
  const [error, setError] = React.useState("");
  const edit = () => { setValue(leader?.notation || ""); setError(""); setEditing(true); };
  const save = async (event) => {
    event.preventDefault();
    if (!describeVimLeader(value)) { setError("Enter a leader key, such as <Space> or a backslash."); return; }
    try { await onSave(value); setEditing(false); }
    catch (e) { setError(`Could not save leader: ${e.message}`); }
  };
  let message = "Press the highlighted leader, then a command key.";
  if (!leader) message = "Set your leader to highlight it on the keyboard.";
  else if (!captureKeys) message = "Keyboard capture is off.";
  else if (received) message = "Leader received · Continue the sequence. Backspace resets it.";
  else if (pressedEvents.length) message = "Continue the sequence or press Backspace to reset.";

  return <section aria-label="Vim leader" className={`vim-leader-panel${received && captureKeys ? " leader-received" : ""}`}>
    <div className="vim-leader-summary"><span className="vim-leader-label">VIM LEADER</span>
      {leader ? <kbd className="vim-leader-keycap">{leader.label}</kbd> : <span className="vim-leader-unavailable">Not recorded</span>}
    </div>
    {editing ? <form className="vim-leader-editor" onSubmit={save}>
      <label>Leader key<input value={value} onChange={(e) => setValue(e.target.value)} autoFocus required spellCheck={false} placeholder="e.g. <Space>" /></label>
      <button type="submit" disabled={saving}>{saving ? "Saving…" : "Save leader"}</button>
      <button type="button" disabled={saving} onClick={() => setEditing(false)}>Cancel</button>
      {error && <span role="alert">{error}</span>}
    </form> : <><p className="vim-leader-message" aria-live="polite">{message}</p><button type="button" className="vim-leader-edit" onClick={edit}>{leader ? "Edit leader" : "Set leader"}</button></>}
  </section>;
}
