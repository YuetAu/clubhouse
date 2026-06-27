"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

interface Props {
  stream: MediaStream;
  sharerName: string;
}

export function ScreenSharePreview({ stream, sharerName }: Props) {
  const previewRef = useRef<HTMLVideoElement>(null);
  const fullscreenRef = useRef<HTMLVideoElement>(null);
  const [maximized, setMaximized] = useState(false);
  // iPad Safari delivers getDisplayMedia with swapped width/height metadata, rotating the frame 90°.
  // Detect this and counter-rotate.
  const [needsRotation, setNeedsRotation] = useState(false);

  useEffect(() => {
    if (previewRef.current) previewRef.current.srcObject = stream;
  }, [stream]);

  useEffect(() => {
    if (fullscreenRef.current && maximized) {
      fullscreenRef.current.srcObject = stream;
    }
  }, [stream, maximized]);

  // Close on Escape
  useEffect(() => {
    if (!maximized) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setMaximized(false); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [maximized]);

  const handleMetadata = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const v = e.currentTarget;
    setNeedsRotation(v.videoHeight > v.videoWidth);
  };

  // For the aspect-video (16:9) preview container: swap to 9/16 × 16/9 so the -90deg
  // rotation makes the video fill the container correctly.
  const previewRotationStyle: React.CSSProperties = {
    position: "absolute",
    width: "56.25%",   // 9/16 of container width = container height
    height: "177.78%", // 16/9 of container height = container width
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%) rotate(-90deg)",
    objectFit: "contain",
  };

  // For the fullscreen overlay (p-6 = 1.5rem each side → 3rem total):
  const fsRotationStyle: React.CSSProperties = {
    position: "absolute",
    width: "calc(100vh - 3rem)",
    height: "calc(100vw - 3rem)",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%) rotate(-90deg)",
    objectFit: "contain",
    borderRadius: "0.5rem",
  };

  return (
    <>
      <div className="relative rounded-xl overflow-hidden bg-black border border-gray-700 aspect-video h-[33vh]">
        <video
          ref={previewRef}
          autoPlay
          playsInline
          muted
          onLoadedMetadata={handleMetadata}
          className={needsRotation ? undefined : "w-full h-full object-contain"}
          style={needsRotation ? previewRotationStyle : undefined}
        />
        <div className="absolute bottom-2 left-2 text-xs text-white bg-black/60 px-2 py-1 rounded-md select-none">
          {sharerName} · Screen share
        </div>
        <button
          onClick={() => setMaximized(true)}
          className="absolute top-2 right-2 p-1.5 rounded-md bg-black/60 text-white hover:bg-black/80 transition-colors"
          title="Maximize"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
          </svg>
        </button>
      </div>

      {maximized && typeof document !== "undefined" && createPortal(
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
          onClick={() => setMaximized(false)}
        >
          <div
            className="relative w-full h-full flex items-center justify-center p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <video
              ref={fullscreenRef}
              autoPlay
              playsInline
              muted
              onLoadedMetadata={handleMetadata}
              className={needsRotation ? undefined : "max-w-full max-h-full rounded-lg object-contain"}
              style={needsRotation ? fsRotationStyle : undefined}
            />
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-sm text-white bg-black/60 px-3 py-1.5 rounded-full select-none pointer-events-none">
              {sharerName} · Screen share
            </div>
            <button
              onClick={() => setMaximized(false)}
              className="absolute top-4 right-4 p-2 rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors"
              title="Close (Esc)"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
