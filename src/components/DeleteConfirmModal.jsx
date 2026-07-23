import React, { useEffect, useRef } from "react";
import { useFocusTrap } from "../hooks/useFocusTrap.js";
import { Button, Modal } from "./DesignSystem.jsx";

// A11Y-02, A11Y-04, PERF-05: Accessible delete confirmation modal with focus trap,
// alertdialog role, Escape key handler, focus restoration, and React.memo.
// UX-09: isLoading prop disables buttons and shows spinner during async deletion.
const DeleteConfirmModal = ({ message, onConfirm, onCancel, isLoading = false }) => {
  const containerRef = useRef(null);
  useFocusTrap(containerRef);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onCancel]);

  return (
    <Modal
      ref={containerRef}
      role="alertdialog"
      title="Confirm Deletion"
      titleId="delete-confirm-title"
      descriptionId="delete-confirm-msg"
      size="md"
      hideClose
      onScrimClick={() => !isLoading && onCancel()}
      footer={
        <>
          <Button intent="secondary" onClick={onCancel} disabled={isLoading}>
            Cancel
          </Button>
          <Button intent="danger" onClick={onConfirm} loading={isLoading}>
            {isLoading ? "Deleting…" : "Delete"}
          </Button>
        </>
      }
    >
      <p id="delete-confirm-msg" className="text-secondary-text text-center">
        {message}
      </p>
    </Modal>
  );
};

export default React.memo(DeleteConfirmModal);
