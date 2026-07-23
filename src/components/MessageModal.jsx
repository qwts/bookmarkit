import React, { useEffect, useRef } from "react";
import { useFocusTrap } from "../hooks/useFocusTrap.js";
import { Banner, Button, Modal } from "./DesignSystem.jsx";

// A11Y-02, A11Y-04, PERF-05: Accessible message modal with focus trap, live region
// announcement, Escape key handler, focus restoration, and React.memo.
const MessageModal = ({ message, type = "info", onClose }) => {
  const containerRef = useRef(null);
  useFocusTrap(containerRef);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <Modal
      ref={containerRef}
      title={type === "success" ? "Success!" : type === "error" ? "Error!" : "Information"}
      titleId="message-modal-title"
      size="sm"
      onClose={onClose}
      footer={
        <Button intent="secondary" onClick={onClose}>
          Close
        </Button>
      }
    >
      <Banner tone={type === "error" ? "error" : type}>{message}</Banner>
    </Modal>
  );
};

export default React.memo(MessageModal);
