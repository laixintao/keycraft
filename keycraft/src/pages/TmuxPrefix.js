import React from "react";
import { matchOneKey } from "../utils/keyMatching";
import "./TmuxPrefix.css";

export default function TmuxPrefix({ prefixes, pressedEvents, captureKeys, tableEnabled }) {
  const active = pressedEvents.length > 0 && prefixes.find((prefix) => prefix.key && matchOneKey(pressedEvents[0], prefix.key));
  const ready = Boolean(active && pressedEvents.length === 1 && captureKeys && tableEnabled);
  let message = "Press a prefix, release it, then press a command key.";
  if (!prefixes.length) message = "No prefix recorded in this snapshot.";
  else if (!captureKeys) message = "Keyboard capture is off.";
  else if (tableEnabled === undefined) message = "This snapshot has no prefix-table bindings.";
  else if (!tableEnabled) message = "Select the prefix table to explore these bindings.";
  else if (ready) message = "Prefix received — press the next key.";
  else if (active) message = "Sequence entered · Backspace resets it.";
  else if (pressedEvents.length) message = "Sequence without prefix · Backspace starts again.";

  return <section aria-label="tmux prefix" className={`tmux-prefix-panel ${ready ? "prefix-ready" : ""}`}>
    <div className="tmux-prefix-step">
      <span className="prefix-step-number">{active ? "✓" : "1"}</span>
      <div><span className="prefix-step-label">TMUX PREFIX</span><div className="prefix-options">
        {prefixes.map((prefix, index) => <React.Fragment key={prefix.notation}>
          {index > 0 && <span className="prefix-or">or</span>}
          <kbd className={`prefix-keycap ${active?.notation === prefix.notation ? "prefix-keycap-active" : ""}`}>{prefix.label}</kbd>
        </React.Fragment>)}
        {!prefixes.length && <span className="prefix-unavailable">Not available</span>}
      </div></div>
    </div>
    <span className="prefix-then" aria-hidden="true">→</span>
    <div className="tmux-prefix-step prefix-next-step"><span className="prefix-step-number">2</span><div><span className="prefix-step-label">THEN A COMMAND KEY</span><p aria-live="polite" className="prefix-message">{message}</p></div></div>
    <span className="prefix-scope-note">Root & copy-mode keys work without prefix.</span>
  </section>;
}
