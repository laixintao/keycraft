import { Dialog, DialogBody, DialogFooter, Button } from "@blueprintjs/core";
import React from "react";
export default function KeyMappingDetail({ showKeyMap, setShowKeyMap }) {
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    if (showKeyMap === null) {
      setOpen(false);
    } else {
      setOpen(true);
    }
  }, [showKeyMap, setOpen]);

  const close = () => {
    setOpen(false);
    setShowKeyMap(null);
  };

  return (
    <Dialog
      title="MAPPING DETAIL"
      icon="info-sign"
      isOpen={open}
      onClose={close}
    >
      <DialogBody>
        {open && (
          <div>
            <p>{showKeyMap.table ? "tmux key table" : "Vim mode"}: {showKeyMap.cmd || "normal, visual, operator-pending"}</p>
            <p>Mapping from: {showKeyMap.lhs}</p>
            <p>Mapping to: {showKeyMap.rhs}</p>
            <p>Set by: {showKeyMap.setting_source}</p>
            <p>raw code: {showKeyMap.raw}</p>
            <p>verbose: {showKeyMap.verbose}</p>

            {showKeyMap.tag && (
              <div>
                type <code>:help {showKeyMap.tag}</code> in your Vim for more
                information
              </div>
            )}
          </div>
        )}
      </DialogBody>
      <DialogFooter
        actions={<Button intent="primary" text="Close" onClick={close} />}
      />
    </Dialog>
  );
}
