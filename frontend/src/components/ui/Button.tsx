import { clsx } from "clsx";
import { ButtonHTMLAttributes } from "react";
import { ShimmerButton } from "./shimmer-button";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
  shimmer?: boolean;
}

const variants = {
  primary: "bg-[#00C853] hover:bg-[#00A844] text-white",
  secondary: "bg-[var(--night-card)] hover:bg-[var(--night-raised)] text-[var(--night-text)] border border-[var(--night-border)]",
  danger: "bg-red-500 hover:bg-red-600 text-white",
  ghost: "bg-transparent hover:bg-[var(--night-raised)] text-[var(--night-muted)] hover:text-[var(--night-text)]",
};

const sizes = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-4 py-2 text-sm",
  lg: "px-6 py-3 text-base",
};

const shimmerSizes = {
  sm: { padding: "px-3 py-1.5", font: "text-sm" },
  md: { padding: "px-4 py-2", font: "text-sm" },
  lg: { padding: "px-6 py-3", font: "text-base" },
};

export function Button({ variant = "primary", size = "md", shimmer, className, children, disabled, onClick, type, ...props }: Props) {
  if (shimmer && variant === "primary") {
    return (
      <ShimmerButton
        className={clsx(shimmerSizes[size].padding, shimmerSizes[size].font, className)}
        disabled={disabled}
        onClick={onClick}
        type={type}
      >
        {children}
      </ShimmerButton>
    );
  }

  return (
    <button
      className={clsx(
        "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed",
        variants[variant],
        sizes[size],
        className
      )}
      disabled={disabled}
      onClick={onClick}
      type={type}
      {...props}
    >
      {children}
    </button>
  );
}
