import { MODIFIERS, realShift, VIMKEY2JSKEY } from "../utils/keyFunctions";
import { Button } from "@blueprintjs/core";

const PressedKeys = ({ pressed, currentPressed, handleClearKey, style }) => {
  // FIXME some key with ctrl and shift got some issue, for example:
  // Ctrl + Shift ' should be Ctrl + " but actually Ctrl + '
  const pressedAnyKey =
    (currentPressed !== null && currentPressed !== undefined) ||
    (pressed !== null && pressed !== undefined && pressed.length > 0);
  return (
    <div className="pressed-key-box" style={style}>
      {pressedAnyKey ? (
        <>
          <div className="pressed-keys-display">
            {pressed.map((e, index) => (
              <PressedKey key={index} keyEvent={e}></PressedKey>
            ))}
            {currentPressed && (
              <PressedKey keyEvent={currentPressed}></PressedKey>
            )}
          </div>
          <Button onClick={handleClearKey} title="Clear sequence (Backspace)" aria-keyshortcuts="Backspace">Clear sequence</Button>
        </>
      ) : (
        <NoAnyKey />
      )}
    </div>
  );
};

const NoAnyKey = () => (
  <div className="sequence-hint"><span>Press a key sequence to explore its mappings</span><span><kbd>⌫ Backspace</kbd> to reset</span></div>
);

const PressedKey = ({ keyEvent }) => {
  const display = [];
  if (keyEvent.altKey) {
    display.push("Alt");
  }
  if (keyEvent.ctrlKey) {
    display.push("Ctrl");
  }
  if (realShift(keyEvent)) {
    display.push("Shift");
  }
  if (keyEvent.metaKey) {
    display.push("⌘");
  }

  if (MODIFIERS.indexOf(keyEvent.key) === -1) {
    if (Object.values(VIMKEY2JSKEY).indexOf(keyEvent.code) !== -1) {
      display.push(keyEvent.code);
    } else {
      display.push(keyEvent.key);
    }
  }

  const text = display.join(" + ");

  return <kbd className="pressed-key">{text}</kbd>;
};

export default PressedKeys;
