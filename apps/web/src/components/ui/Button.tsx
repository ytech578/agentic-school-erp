import React from "react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "outline";
  size?: "sm" | "md" | "lg" | "icon";
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className = "",
      variant = "primary",
      size = "md",
      isLoading = false,
      leftIcon,
      rightIcon,
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    let variantClass = "btn-primary";
    if (variant === "secondary") variantClass = "btn-secondary";
    if (variant === "ghost") variantClass = "btn-ghost";
    if (variant === "danger") variantClass = "btn-danger"; // Assuming this might be added to CSS
    if (variant === "outline") variantClass = "btn-outline";

    let sizeClass = "px-4 py-2 text-sm";
    if (size === "sm") sizeClass = "px-3 py-1.5 text-xs";
    if (size === "lg") sizeClass = "px-6 py-3 text-base";
    if (size === "icon") sizeClass = "p-2";

    const baseClass = `btn ${variantClass} ${className}`;

    return (
      <button
        ref={ref}
        className={baseClass}
        disabled={disabled || isLoading}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "0.5rem",
          padding: size === "icon" ? "0.5rem" : undefined,
        }}
        {...props}
      >
        {isLoading && (
          <span className="spinner" style={{ display: 'inline-block', width: '1em', height: '1em', border: '2px solid currentColor', borderRightColor: 'transparent', borderRadius: '50%' }} />
        )}
        {!isLoading && leftIcon}
        {children}
        {!isLoading && rightIcon}
      </button>
    );
  }
);
Button.displayName = "Button";
