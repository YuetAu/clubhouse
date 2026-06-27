"use client";

import React, { useCallback, useEffect } from "react";
import { motion, useMotionTemplate, useMotionValue } from "motion/react";
import { clsx } from "clsx";

interface MagicCardProps {
  children?: React.ReactNode;
  className?: string;
  gradientSize?: number;
  gradientColor?: string;
  gradientOpacity?: number;
  gradientFrom?: string;
  gradientTo?: string;
}

export function MagicCard({
  children,
  className,
  gradientSize = 200,
  gradientColor = "rgba(0, 200, 83, 0.06)",
  gradientOpacity = 1,
  gradientFrom = "#00C853",
  gradientTo = "#e8e3d8",
}: MagicCardProps) {
  const mouseX = useMotionValue(-gradientSize);
  const mouseY = useMotionValue(-gradientSize);

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      mouseX.set(e.clientX - rect.left);
      mouseY.set(e.clientY - rect.top);
    },
    [mouseX, mouseY]
  );

  const handlePointerLeave = useCallback(() => {
    mouseX.set(-gradientSize);
    mouseY.set(-gradientSize);
  }, [mouseX, mouseY, gradientSize]);

  useEffect(() => {
    mouseX.set(-gradientSize);
    mouseY.set(-gradientSize);
  }, [mouseX, mouseY, gradientSize]);

  return (
    <motion.div
      className={clsx(
        "group relative isolate overflow-hidden rounded-[inherit] border border-transparent",
        className
      )}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      style={{
        background: useMotionTemplate`
          linear-gradient(#ffffff 0 0) padding-box,
          radial-gradient(${gradientSize}px circle at ${mouseX}px ${mouseY}px,
            ${gradientFrom},
            ${gradientTo},
            #ddd8ce 100%
          ) border-box
        `,
      }}
    >
      {/* card background fill */}
      <div className="absolute inset-px z-20 rounded-[inherit] bg-white" />

      {/* interior gradient glow on hover */}
      <motion.div
        className="pointer-events-none absolute inset-px z-30 rounded-[inherit] opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background: useMotionTemplate`
            radial-gradient(${gradientSize}px circle at ${mouseX}px ${mouseY}px,
              ${gradientColor},
              transparent 100%
            )
          `,
          opacity: gradientOpacity,
        }}
      />

      <div className="relative z-40">{children}</div>
    </motion.div>
  );
}
