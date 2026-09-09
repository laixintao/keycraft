const VIMKEY2JSKEY = {
  BS: "Backspace",
  Tab: "Tab",
  CR: "Enter",
  Enter: "Enter",
  Return: "Enter",
  Esc: "Escape",
  Space: "Space",
  Up: "ArrowUp",
  Down: "ArrowDown",
  Left: "ArrowLeft",
  Right: "ArrowRight",
  Insert: "Insert",
  Del: "Delete",
  Home: "Home",
  End: "End",
  PageUp: "PageUp",
  PageDown: "PageDown",
  bar: "|",
  lt: "<",
  Bslash: "\\",
};
const realShift = (keyEvent) => {
  // if shift pressed with a, effactly is 'A', that shouldn't be considered as
  // shift pressed
  if (keyEvent.key === "Shift") {
    return true;
  }
  if (
    keyEvent.shiftKey &&
    Object.values(VIMKEY2JSKEY).indexOf(keyEvent.code) !== -1
  ) {
    return true;
  }

  return false;
};
const MODIFIERS = ["Shift", "Meta", "Alt", "Control"];
export { realShift , VIMKEY2JSKEY, MODIFIERS};
