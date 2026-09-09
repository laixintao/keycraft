import { describeVimLeader, vimLeaderProgress } from "./vimLeader";
import { parseImport } from "./importMappings";

const event = (key, code, more = {}) => ({ key, code, ctrlKey: false, altKey: false, metaKey: false, shiftKey: false, ...more });

test.each([
  ["\\", ["\\"]], [",", [","]], ["<Space>", ["Space"]], [" ", ["Space"]],
  ["<C-a>", ["Control", "a"]], ["<lt>", ["Shift", "<"]],
])("leader %s highlights its physical keys", (notation, physicalKeys) => {
  expect(vimLeaderProgress(describeVimLeader(notation), [])).toEqual({ received: false, physicalKeys });
});

test("multi-key leaders advance one key at a time and reset without truncation", () => {
  const leader = describeVimLeader("g<Space>");
  expect(leader.label).toBe("G → Space");
  expect(vimLeaderProgress(leader, []).physicalKeys).toEqual(["g"]);
  expect(vimLeaderProgress(leader, [event("g", "KeyG")])).toEqual({ received: false, physicalKeys: ["Space"] });
  expect(vimLeaderProgress(leader, [event("g", "KeyG"), event(" ", "Space")])).toEqual({ received: true, physicalKeys: [] });
  expect(vimLeaderProgress(leader, [event("x", "KeyX")])).toEqual({ received: false, physicalKeys: [] });
  expect(vimLeaderProgress(leader, []).physicalKeys).toEqual(["g"]);
});

test("Vim import carries leader metadata without guessing for older exports", () => {
  const data = { leader: "<Space>", scripts: [], mappings: [{ lhs: "<Space>w", rhs: ":w<CR>", mode: "n" }] };
  expect(parseImport({ kind: "vim", format: "vim-maplist", text: JSON.stringify(data) }).vimLeader).toBe("<Space>");
  delete data.leader;
  expect(parseImport({ kind: "vim", format: "vim-maplist", text: JSON.stringify(data) }).vimLeader).toBeUndefined();
  const text = "n  ,w          * :w<CR>";
  expect(parseImport({ kind: "vim", text, vimLeader: "," }).vimLeader).toBe(",");
  expect(parseImport({ kind: "vim", text }).vimLeader).toBeUndefined();
  expect(describeVimLeader(undefined)).toBeNull();
  expect(vimLeaderProgress(null, [])).toEqual({ received: false, physicalKeys: [] });
});
