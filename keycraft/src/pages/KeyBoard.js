import KeyBoardModalMacBook from "../keyboards/ModalMacBook";
import "./KeyBoard.css";

export default function KeyBoard({
  style,
  matchedKeyMappings,
  currentPressed,
  prefixKeys = [],
  leaderKeys = [],
}) {
  const groupedByKeys = matchedKeyMappings
    .filter((k) => k.nextExpect !== null && k.nextExpect !== undefined)
    .filter((k) => {
      let shiftKey = false;
      let metaKey = false;
      let altKey = false;
      let ctrlKey = false;
      if (currentPressed !== null && currentPressed !== undefined) {
        shiftKey = currentPressed.shiftKey;
        metaKey = currentPressed.metaKey;
        altKey = currentPressed.altKey;
        ctrlKey = currentPressed.ctrlKey;
      }
      const { needShift, needMeta, needAlt, needControl } = k.nextExpect;

      // Control
      if (needControl !== ctrlKey) {
        return false;
      }

      // Alt
      if (needAlt !== altKey) {
        return false;
      }
      // Meta
      if (needMeta !== metaKey) {
        return false;
      }
      // Shift: should press but didn't
      if (needShift && !shiftKey) {
        return false;
      }

      if (k.nextExpect.key.length === 1 && !ctrlKey) {
        const shifted = /[A-Z~!@#$%^&*()_+{}|:"<>?]/.test(k.nextExpect.key);
        if (shifted !== shiftKey) return false;
      }
      return true;
    })
    .reduce((group, keyMap) => {
      const nextKey = keyMap.nextExpect?.key;
      const key = nextKey?.length === 1 ? nextKey.toLowerCase() : nextKey;

      group[key] = group[key] ?? [];
      group[key].push(keyMap);
      return group;
    }, {});

  // 后面展示每一个按键绑定的内容
  // 每一个按键可以绑定多个 group
  // 按下 shift 的时候切换 group 中显示的内容
  return (
    <div className="keyboard-container" style={style}>
      <KeyBoardModalMacBook mappingsByKeys={groupedByKeys} prefixKeys={prefixKeys} leaderKeys={leaderKeys} />{" "}
    </div>
  );
}
