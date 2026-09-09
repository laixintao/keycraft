// https://codepen.io/gschier/pen/VKgyaY

import "./ModalMacBook.css";
import { useState, useContext, useLayoutEffect } from "react";
import { CurrentMappingsContext, PrefixKeysContext, LeaderKeysContext } from "./CurrentMappingsContext";

const Key = ({ bindkeys, displayKey, styleClass }) => {
  const currentMappings = useContext(CurrentMappingsContext);
  const prefixKeys = useContext(PrefixKeysContext);
  const isPrefix = bindkeys.some((key) => prefixKeys.includes(key));
  const leaderKeys = useContext(LeaderKeysContext);
  const isLeader = bindkeys.some((key) => leaderKeys.includes(key));
  const displayMappings = bindkeys
    .map((b) => currentMappings[b])
    .filter(Boolean)
    .reduce((prev, item) => prev.concat(item), []);

  let activeClass = "no-mappings";
  let hasMappings = false;
  if (displayMappings && displayMappings.length > 0) {
    activeClass = "has-mappings";
    hasMappings = true;
  }

  return (
    <div className={`${styleClass} ${activeClass} key${isPrefix ? " tmux-prefix-key" : ""}${isLeader ? " vim-leader-key" : ""}`} title={isLeader ? "Vim leader key" : isPrefix ? "Part of the tmux prefix" : undefined}>
      {displayKey.length > 1 ? (
        displayKey.map((k) => <div key={k}>{k}</div>)
      ) : (
        <span>{displayKey[0]}</span>
      )}

      {hasMappings && (
        <span className="matched-count">{displayMappings.length}</span>
      )}
      {isLeader && <span className="leader-key-badge">LEADER</span>}
    </div>
  );
};

const keyboardFontSize = () => Math.min(window.innerWidth / 83, window.innerHeight / 68, 14) + "px";
export default function ModalMacBook({ mappingsByKeys, prefixKeys = [], leaderKeys = [] }) {
  const [fontSize, setFontSize] = useState(keyboardFontSize);

  useLayoutEffect(() => {
    function handleResize() {
      setFontSize(keyboardFontSize());
    }

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    // context: mappingsByKeys={mappingsByKeys}
    <PrefixKeysContext.Provider value={prefixKeys}>
    <LeaderKeysContext.Provider value={leaderKeys}>
    <CurrentMappingsContext.Provider value={mappingsByKeys}>
      <div className="keyboard" style={{ fontSize: fontSize }}>
        <div className="keyboard__row keyboard__row--h1">
          <Key
            bindkeys={["Escape"]}
            displayKey={["esc"]}
            styleClass="key--word"
          />
          <Key bindkeys={["F1"]} displayKey={["F1"]} styleClass="key--fn" />

          <Key styleClass="key--fn" displayKey={["F2"]} bindkeys={["F2"]} />
          <Key styleClass="key--fn" displayKey={["F3"]} bindkeys={["F3"]} />
          <Key styleClass="key--fn" displayKey={["F4"]} bindkeys={["F4"]} />
          <Key styleClass="key--fn" displayKey={["F5"]} bindkeys={["F5"]} />
          <Key styleClass="key--fn" displayKey={["F6"]} bindkeys={["F6"]} />
          <Key styleClass="key--fn" displayKey={["F7"]} bindkeys={["F7"]} />
          <Key styleClass="key--fn" displayKey={["F8"]} bindkeys={["F8"]} />
          <Key styleClass="key--fn" displayKey={["F9"]} bindkeys={["F9"]} />
          <Key styleClass="key--fn" displayKey={["F10"]} bindkeys={["F10"]} />
          <Key styleClass="key--fn" displayKey={["F11"]} bindkeys={["F11"]} />
          <Key styleClass="key--fn" displayKey={["F12"]} bindkeys={["F12"]} />
          <Key
            data-key="n/a"
            styleClass="key--word"
            displayKey={[" "]}
            bindkeys={[]}
          />
        </div>
        <div className="keyboard__row">
          <Key
            styleClass="key--double"
            displayKey={["~", "`"]}
            bindkeys={["~", "`"]}
          />

          <Key
            styleClass="key--double"
            displayKey={["!", "1"]}
            bindkeys={["!", "1"]}
          />

          <Key
            styleClass="key--double"
            displayKey={["@", "2"]}
            bindkeys={["@", "2"]}
          />
          <Key
            styleClass="key--double"
            displayKey={["#", "3"]}
            bindkeys={["#", "3"]}
          />
          <Key
            styleClass="key--double"
            displayKey={["$", "4"]}
            bindkeys={["$", "4"]}
          />
          <Key
            styleClass="key--double"
            displayKey={["%", "5"]}
            bindkeys={["%", "5"]}
          />
          <Key
            styleClass="key--double"
            displayKey={["^", "6"]}
            bindkeys={["^", "6"]}
          />
          <Key
            styleClass="key--double"
            displayKey={["&", "7"]}
            bindkeys={["&", "7"]}
          />
          <Key
            styleClass="key--double"
            displayKey={["*", "8"]}
            bindkeys={["*", "8"]}
          />
          <Key
            styleClass="key--double"
            displayKey={["(", "9"]}
            bindkeys={["(", "9"]}
          />
          <Key
            styleClass="key--double"
            displayKey={[")", "0"]}
            bindkeys={[")", "0"]}
          />
          <Key
            styleClass="key--double"
            displayKey={["_", "-"]}
            bindkeys={["_", "-"]}
          />
          <Key
            styleClass="key--double"
            displayKey={["+", "="]}
            bindkeys={["+", "="]}
          />
          <Key
            styleClass="key--bottom-right key--word key--w4"
            displayKey={["delete"]}
            bindkeys={["Backspace"]}
          />
        </div>
        <div className="keyboard__row">
          <Key
            styleClass="key--bottom-left key--word key--w4"
            displayKey={["tab"]}
            bindkeys={["Tab"]}
          />
          <Key styleClass="key--letter" displayKey={["Q"]} bindkeys={["q"]} />
          <Key styleClass="key--letter" displayKey={["W"]} bindkeys={["w"]} />
          <Key styleClass="key--letter" displayKey={["E"]} bindkeys={["e"]} />
          <Key styleClass="key--letter" displayKey={["R"]} bindkeys={["r"]} />
          <Key styleClass="key--letter" displayKey={["T"]} bindkeys={["t"]} />
          <Key styleClass="key--letter" displayKey={["Y"]} bindkeys={["y"]} />
          <Key styleClass="key--letter" displayKey={["U"]} bindkeys={["u"]} />
          <Key styleClass="key--letter" displayKey={["I"]} bindkeys={["i"]} />
          <Key styleClass="key--letter" displayKey={["O"]} bindkeys={["o"]} />
          <Key styleClass="key--letter" displayKey={["P"]} bindkeys={["p"]} />

          <Key
            styleClass="key--double"
            displayKey={["{", "["]}
            bindkeys={["{", "["]}
          />
          <Key
            styleClass="key--double"
            displayKey={["}", "]"]}
            bindkeys={["}", "]"]}
          />
          <Key
            styleClass="key--double"
            displayKey={["|", "\\"]}
            bindkeys={["|", "\\"]}
          />
        </div>
        <div className="keyboard__row">
          <Key
            styleClass="key--bottom-left key--word key--w5"
            displayKey={["caps lock"]}
            bindkeys={[]}
          />

          <Key styleClass="key--letter" displayKey={["A"]} bindkeys={["a"]} />
          <Key styleClass="key--letter" displayKey={["S"]} bindkeys={["s"]} />
          <Key styleClass="key--letter" displayKey={["D"]} bindkeys={["d"]} />
          <Key styleClass="key--letter" displayKey={["F"]} bindkeys={["f"]} />
          <Key styleClass="key--letter" displayKey={["G"]} bindkeys={["g"]} />
          <Key styleClass="key--letter" displayKey={["H"]} bindkeys={["h"]} />
          <Key styleClass="key--letter" displayKey={["J"]} bindkeys={["j"]} />
          <Key styleClass="key--letter" displayKey={["K"]} bindkeys={["k"]} />
          <Key styleClass="key--letter" displayKey={["L"]} bindkeys={["l"]} />

          <Key
            styleClass="key--double"
            displayKey={[":", ";"]}
            bindkeys={[":", ";"]}
          />

          <Key
            styleClass="key--double"
            displayKey={['"', "'"]}
            bindkeys={['"', "'"]}
          />

          <Key
            styleClass="key--bottom-right key--word key--w5"
            displayKey={["return"]}
            bindkeys={["Enter"]}
          />
        </div>
        <div className="keyboard__row">
          <Key
            styleClass="key--bottom-left key--word key--w6"
            displayKey={["shift"]}
            bindkeys={["Shift"]}
          />
          <Key styleClass="key--letter" displayKey={["Z"]} bindkeys={["z"]} />
          <Key styleClass="key--letter" displayKey={["X"]} bindkeys={["x"]} />
          <Key styleClass="key--letter" displayKey={["C"]} bindkeys={["c"]} />
          <Key styleClass="key--letter" displayKey={["V"]} bindkeys={["v"]} />
          <Key styleClass="key--letter" displayKey={["B"]} bindkeys={["b"]} />
          <Key styleClass="key--letter" displayKey={["N"]} bindkeys={["n"]} />
          <Key styleClass="key--letter" displayKey={["M"]} bindkeys={["m"]} />

          <Key
            styleClass="key--double"
            displayKey={["<", ","]}
            bindkeys={["<", ","]}
          />

          <Key
            styleClass="key--double"
            displayKey={[">", "."]}
            bindkeys={[">", "."]}
          />
          <Key
            styleClass="key--double"
            displayKey={["?", "/"]}
            bindkeys={["?", "/"]}
          />

          <Key
            styleClass="key--bottom-right key--word key--w6"
            displayKey={["shift"]}
            bindkeys={["Shift"]}
          />
        </div>
        <div className="keyboard__row keyboard__row--h3">
          <Key
            styleClass="key--bottom-left key--word"
            displayKey={["fn"]}
            bindkeys={[]}
          />
          <Key
            styleClass="key--bottom-left key--word key--w1"
            displayKey={["control"]}
            bindkeys={["Control"]}
          />
          <Key
            styleClass="key--bottom-left key--word key--w1"
            displayKey={["option"]}
            bindkeys={["Alt"]}
          />
          <Key
            styleClass="key--bottom-right key--word key--w3"
            displayKey={["command"]}
            bindkeys={["Meta"]}
          />
          <Key
            styleClass="key--double key--right key--space"
            displayKey={[" "]}
            bindkeys={["Space"]}
          />
          <Key
            styleClass="key--bottom-left key--word key--w3"
            displayKey={["command"]}
            bindkeys={["Meta"]}
          />
          <Key
            styleClass="key--bottom-left key--word key--w1"
            displayKey={["option"]}
            bindkeys={["Alt"]}
          />
          <Key
            styleClass="key--arrow"
            displayKey={["◀"]}
            bindkeys={["ArrowLeft"]}
          />
          <div className="arrow-twin">
            <Key
              styleClass="key--arrow key--stack"
              displayKey={["▲"]}
              bindkeys={["ArrowUp"]}
            />
            <Key
              styleClass="key--arrow key--stack"
              displayKey={["▼"]}
              bindkeys={["ArrowDown"]}
            />
          </div>
          <Key
            styleClass="key--arrow"
            displayKey={["►"]}
            bindkeys={["ArrowRight"]}
          />
        </div>
      </div>
    </CurrentMappingsContext.Provider>
    </LeaderKeysContext.Provider>
    </PrefixKeysContext.Provider>
  );
}
