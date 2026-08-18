import React from "react";

interface PanelProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  headerClassName?: string;
}

export function Panel({
  children,
  title,
  subtitle,
  badge,
  actions,
  className = "",
  headerClassName = "",
}: PanelProps) {
  return (
    <div className={`rounded-xl border border-zinc-800 bg-zinc-950/80 p-5 ${className}`}>
      {(title || actions || badge) && (
        <div
          className={`flex flex-wrap items-center justify-between border-b border-zinc-800/80 pb-4 mb-4 gap-2 ${headerClassName}`}
        >
          <div>
            <div className="flex items-center gap-2">
              {title && (
                <h3 className="text-sm font-mono uppercase tracking-widest text-zinc-300 font-bold">
                  {title}
                </h3>
              )}
              {badge}
            </div>
            {subtitle && <p className="text-xs text-zinc-500 mt-0.5">{subtitle}</p>}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </div>
  );
}
