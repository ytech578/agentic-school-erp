import React, { useEffect, useRef } from "react";
import { X } from "lucide-react";

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export function Modal({ isOpen, onClose, title, children, footer }: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    if (isOpen) {
      document.body.style.overflow = "hidden";
      document.addEventListener("keydown", handleKeyDown);
    } else {
      document.body.style.overflow = "unset";
    }

    return () => {
      document.body.style.overflow = "unset";
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "var(--bg-overlay)",
        backdropFilter: "var(--modal-backdrop-blur)",
        WebkitBackdropFilter: "var(--modal-backdrop-blur)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: "1rem",
        animation: "fadeIn 0.2s ease-out",
      }}
      onClick={onClose}
    >
      <div
        ref={modalRef}
        className="modal-dialog"
        style={{
          width: "100%",
          maxWidth: "500px",
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          padding: 0,
          backgroundColor: "var(--bg-surface-solid)",
          background: "var(--bg-surface-solid)",
          opacity: 1,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "1.25rem",
            borderBottom: "1px solid var(--border-light)",
          }}
        >
          <h2 style={{ fontSize: "1.25rem", fontWeight: 600, margin: 0 }}>{title}</h2>
          <button
            onClick={onClose}
            className="btn-ghost btn-icon"
            style={{ padding: "0.25rem", color: "var(--text-secondary)" }}
          >
            <X size={20} />
          </button>
        </div>

        <div style={{ padding: "1.25rem", overflowY: "auto" }}>
          {children}
        </div>

        {footer && (
          <div
            style={{
              padding: "1.25rem",
              borderTop: "1px solid var(--border-light)",
              display: "flex",
              justifyContent: "flex-end",
              gap: "0.75rem",
              backgroundColor: "var(--bg-surface-hover)",
            }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
