export function describeKeyPress(key) {
  const names = { " ": "Space", ArrowLeft: "←", ArrowRight: "→", ArrowUp: "↑", ArrowDown: "↓", Escape: "Esc" };
  const modifiers = [key.needControl && "Ctrl", key.needAlt && "Alt", key.needShift && "Shift", key.needMeta && "⌘"].filter(Boolean);
  const label = [...modifiers, names[key.key] || (/^[a-z]$/i.test(key.key) ? key.key.toUpperCase() : key.key)].join(" + ");
  const physicalKeys = [
    key.needControl && "Control", key.needAlt && "Alt", key.needMeta && "Meta",
    (key.needShift || /^[A-Z~!@#$%^&*()_+{}|:"<>?]$/.test(key.key)) && "Shift",
    key.key === " " ? "Space" : key.key.length === 1 ? key.key.toLowerCase() : key.key,
  ].filter(Boolean);
  return { label, key, physicalKeys };
}
