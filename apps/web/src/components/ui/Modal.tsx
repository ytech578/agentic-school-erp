"use client";

import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: string;
}

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  footer,
  maxWidth = "560px",
}: ModalProps) {
  const [mounted, setMounted] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    if (isOpen) {
      document.body.style.overflow = "hidden";
      const pageContent = document.querySelector(".page-content") as HTMLElement | null;
      if (pageContent) {
        pageContent.style.overflow = "hidden";
      }
      document.addEventListener("keydown", handleKeyDown);
    } else {
      document.body.style.overflow = "unset";
      const pageContent = document.querySelector(".page-content") as HTMLElement | null;
      if (pageContent) {
        pageContent.style.overflow = "auto";
      }
    }

    return () => {
      document.body.style.overflow = "unset";
      const pageContent = document.querySelector(".page-content") as HTMLElement | null;
      if (pageContent) {
        pageContent.style.overflow = "auto";
      }
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !mounted) return null;

  const modalContent = (
    <div
      className="modal-backdrop"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: "100vw",
        height: "100vh",
        backgroundColor: "var(--bg-overlay, rgba(15, 23, 42, 0.55))",
        backdropFilter: "var(--modal-backdrop-blur, none)",
        WebkitBackdropFilter: "var(--modal-backdrop-blur, none)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 99999,
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
          maxWidth: maxWidth,
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          padding: 0,
          backgroundColor: "var(--bg-surface-solid, #ffffff)",
          background: "var(--bg-surface-solid, #ffffff)",
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
            type="button"
            onClick={onClose}
            className="btn-ghost btn-icon"
            style={{ padding: "0.25rem", color: "var(--text-secondary)", cursor: "pointer" }}
            aria-label="Close modal"
          >
            <X size={20} />
          </button>
        </div>

        <div style={{ padding: "1.25rem", overflowY: "auto", flex: 1 }}>
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

  return createPortal(modalContent, document.body);
}
