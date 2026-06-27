import { clsx } from "clsx";

interface Props {
  variant: "verified" | "anon" | "host" | "speaker" | "listener";
  className?: string;
}

const styles: Record<Props["variant"], string> = {
  verified: "bg-blue-50 text-blue-600 border border-blue-100 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800",
  anon: "bg-stone-100 text-stone-400 border border-stone-200 dark:bg-stone-800 dark:text-stone-400 dark:border-stone-700",
  host: "bg-amber-50 text-amber-600 border border-amber-100 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800",
  speaker: "bg-[#00C853]/10 text-[#00A844] border border-[#00C853]/20 dark:text-[#00C853]",
  listener: "bg-stone-50 text-stone-400 border border-stone-100 dark:bg-stone-800 dark:text-stone-500 dark:border-stone-700",
};

const labels: Record<Props["variant"], string> = {
  verified: "✓",
  anon: "anon",
  host: "host",
  speaker: "on stage",
  listener: "listener",
};

export function Badge({ variant, className }: Props) {
  return (
    <span className={clsx("inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium", styles[variant], className)}>
      {labels[variant]}
    </span>
  );
}
