import React from "react";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "danger"
  | "warning"
  | "success"
  | "ghost"
  | "outline"
  | "default";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: "sm" | "md" | "lg" | "default";
  isLoading?: boolean;
  icon?: React.ReactNode;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-zinc-100 text-zinc-950 hover:bg-white active:bg-zinc-200 border-zinc-200 shadow-sm font-semibold",
  default:
    "bg-zinc-100 text-zinc-950 hover:bg-white active:bg-zinc-200 border-zinc-200 shadow-sm font-semibold",
  secondary:
    "bg-zinc-900 text-zinc-200 hover:bg-zinc-800 active:bg-zinc-850 border-zinc-800 hover:border-zinc-700",
  outline:
    "bg-transparent text-zinc-300 border-zinc-800 hover:bg-zinc-900 hover:text-white",
  danger:
    "bg-red-950/50 text-red-300 hover:bg-red-900/60 active:bg-red-950 border-red-800/80 hover:border-red-700",
  warning:
    "bg-amber-950/50 text-amber-300 hover:bg-amber-900/60 active:bg-amber-950 border-amber-800/80 hover:border-amber-700",
  success:
    "bg-emerald-950/50 text-emerald-300 hover:bg-emerald-900/60 active:bg-emerald-950 border-emerald-800/80 hover:border-emerald-700",
  ghost:
    "bg-transparent text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 border-transparent",
};

const sizeStyles = {
  sm: "px-2.5 py-1 text-xs font-mono tracking-wider",
  md: "px-4 py-2 text-sm font-mono tracking-wider",
  default: "px-4 py-2 text-sm font-mono tracking-wider",
  lg: "px-6 py-3 text-base font-mono font-semibold tracking-wider",
};

export function Button({
  children,
  variant = "secondary",
  size = "md",
  isLoading = false,
  disabled = false,
  icon,
  className = "",
  ...props
}: ButtonProps) {
  const vStyle = variantStyles[variant] || variantStyles.secondary;
  const sStyle = sizeStyles[size] || sizeStyles.md;

  return (
    <button
      disabled={disabled || isLoading}
      className={`inline-flex items-center justify-center gap-2 rounded border uppercase transition-all duration-150 select-none disabled:opacity-50 disabled:cursor-not-allowed ${vStyle} ${sStyle} ${className}`}
      {...props}
    >
      {isLoading ? (
        <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : (
        icon
      )}
      {children}
    </button>
  );
}

export default Button;
