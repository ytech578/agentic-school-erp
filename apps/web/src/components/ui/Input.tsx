import React from "react";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  leftIcon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className = "", label, error, leftIcon, id, ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem", width: "100%" }}>
        {label && (
          <label
            htmlFor={inputId}
            style={{ fontSize: "0.875rem", fontWeight: 500, color: "var(--text-secondary)" }}
          >
            {label}
          </label>
        )}
        <div style={{ position: "relative" }}>
          {leftIcon && (
            <div
              style={{
                position: "absolute",
                left: "0.75rem",
                top: "50%",
                transform: "translateY(-50%)",
                color: "var(--text-tertiary)",
                pointerEvents: "none",
              }}
            >
              {leftIcon}
            </div>
          )}
          <input
            id={inputId}
            ref={ref}
            className={`input ${error ? "has-error" : ""} ${className}`}
            style={{
              paddingLeft: leftIcon ? "2.5rem" : undefined,
              borderColor: error ? "var(--danger)" : undefined,
            }}
            {...props}
          />
        </div>
        {error && (
          <span style={{ fontSize: "0.75rem", color: "var(--danger)" }}>
            {error}
          </span>
        )}
      </div>
    );
  }
);
Input.displayName = "Input";
