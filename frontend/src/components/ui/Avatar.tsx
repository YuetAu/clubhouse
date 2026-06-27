import Image from "next/image";
import { clsx } from "clsx";

interface Props {
  src: string | null;
  name: string;
  size?: number;
  className?: string;
}

function initials(name: string): string {
  return name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

export function Avatar({ src, name, size = 40, className }: Props) {
  if (src) {
    return (
      <Image
        src={src}
        alt={name}
        width={size}
        height={size}
        className={clsx("rounded-full object-cover", className)}
      />
    );
  }
  return (
    <div
      style={{ width: size, height: size }}
      className={clsx(
        "rounded-full bg-[#00C853] flex items-center justify-center text-white font-semibold shrink-0",
        className
      )}
    >
      <span style={{ fontSize: size * 0.35 }}>{initials(name)}</span>
    </div>
  );
}
