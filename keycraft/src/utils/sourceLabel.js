// Keep existing snapshots readable with the current import labels.
const previousLabels = {
  "Local Vim · effective global mappings": "Vim · global mappings",
  "Local tmux · active server": "tmux · key bindings",
};

export function displaySourceLabel(label) {
  return Object.hasOwn(previousLabels, label) ? previousLabels[label] : label;
}
