import { InputHTMLAttributes } from "react";
import { clsx } from "clsx";

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({ label, error, className, id, ...props }: Props) {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={id} className="text-sm font-semibold text-[var(--night-text)]">
          {label}
        </label>
      )}
      <input
        id={id}
        className={clsx(
          "w-full rounded-xl bg-[var(--night-card)] border border-[var(--night-border)] text-[var(--night-text)] placeholder:text-[var(--night-muted)] px-3 py-2 text-sm focus:outline-none focus:border-[#00C853] focus:ring-2 focus:ring-[#00C853]/10 transition-colors",
          error && "border-red-400 focus:border-red-400 focus:ring-red-100",
          className
        )}
        {...props}
      />
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
