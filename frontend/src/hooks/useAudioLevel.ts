import { useEffect, useRef, useState } from "react";

const THRESHOLD = 12; // RMS units above silence (0–128 scale)
const SMOOTHING = 0.8;

export function useAudioLevel(stream: MediaStream | undefined, muted = false): boolean {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const rafRef = useRef<number | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    if (!stream || muted) {
      setIsSpeaking(false);
      return;
    }

    const audioCtx = new AudioContext();
    ctxRef.current = audioCtx;
    const source = audioCtx.createMediaStreamSource(stream);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = SMOOTHING;
    source.connect(analyser);

    const data = new Uint8Array(analyser.frequencyBinCount);

    function tick() {
      analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) {
        const v = data[i] - 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / data.length);
      setIsSpeaking(rms > THRESHOLD);
      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      source.disconnect();
      audioCtx.close();
      ctxRef.current = null;
    };
  }, [stream, muted]);

  return isSpeaking;
}
