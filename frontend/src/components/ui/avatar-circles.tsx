"use client";

import { clsx } from "clsx";

interface Avatar {
  imageUrl: string;
  profileUrl: string;
  name?: string;
}

interface AvatarCirclesProps {
  className?: string;
  numPeople?: number;
  avatarUrls: Avatar[];
  size?: number;
}

const PLACEHOLDER_COLORS = [
  "bg-[#00C853]",
  "bg-[#00A844]",
  "bg-[#007A30]",
];

export function AvatarCircles({ numPeople, className, avatarUrls, size = 28 }: AvatarCirclesProps) {
  return (
    <div className={clsx("z-10 flex -space-x-2 rtl:space-x-reverse", className)}>
      {avatarUrls.map((url, index) =>
        url.imageUrl ? (
          <img
            key={index}
            className="rounded-full border-2 border-white object-cover"
            src={url.imageUrl}
            width={size}
            height={size}
            style={{ width: size, height: size }}
            alt={url.name ?? `Avatar ${index + 1}`}
          />
        ) : (
          <div
            key={index}
            className={clsx(
              "rounded-full border-2 border-white flex items-center justify-center text-white font-semibold",
              PLACEHOLDER_COLORS[index % PLACEHOLDER_COLORS.length]
            )}
            style={{ width: size, height: size, fontSize: size * 0.35 }}
          >
            {url.name ? url.name[0].toUpperCase() : ""}
          </div>
        )
      )}
      {(numPeople ?? 0) > 0 && (
        <div
          className="flex items-center justify-center rounded-full border-2 border-white bg-stone-100 text-stone-500 font-medium"
          style={{ width: size, height: size, fontSize: size * 0.32 }}
        >
          +{numPeople}
        </div>
      )}
    </div>
  );
}
