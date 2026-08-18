import React from "react";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary" | "destructive" | "outline" | "success" | "warning";
}

export function Badge({
  className = "",
  variant = "default",
  children,
  ...props
}: BadgeProps) {
  const variantStyles = {
    default: "border-transparent bg-zinc-100 text-zinc-900",
    secondary: "border-transparent bg-zinc-800 text-zinc-100",
    destructive: "border-transparent bg-red-900/50 text-red-300",
    outline: "text-zinc-300 border border-zinc-800",
    success: "border-emerald-800/50 bg-emerald-950/20 text-emerald-400",
    warning: "border-amber-800/50 bg-amber-950/20 text-amber-400",
  };

  return (
    <div
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors ${variantStyles[variant] || variantStyles.default} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export default Badge;
