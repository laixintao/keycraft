import { parseVimKeyMappings, matchKeyPressMappings } from "./keyMatching";
import { describeKeyPress } from "./keyDescription";

export function describeVimLeader(notation) {
  if (typeof notation !== "string" || !notation.length) return null;
  const mapping = parseVimKeyMappings([{ lhs: notation }])[0];
  if (!mapping) return null;
  const keys = mapping.jsKeys.map(describeKeyPress);
  return { notation, jsKeys: mapping.jsKeys, keys, label: keys.map((key) => key.label).join(" → ") };
}

export function vimLeaderProgress(leader, events) {
  if (!leader) return { received: false, physicalKeys: [] };
  const matching = matchKeyPressMappings(events.slice(0, leader.jsKeys.length), leader);
  const received = matching && events.length >= leader.jsKeys.length;
  return { received, physicalKeys: matching && !received ? leader.keys[events.length].physicalKeys : [] };
}
