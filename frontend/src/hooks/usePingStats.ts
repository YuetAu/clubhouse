import { useEffect, useRef, useState } from "react";

/**
 * Hook to track RTT (round-trip time) for a specific peer connection
 * Returns ping in milliseconds
 */
export function usePingStats(
  pc: RTCPeerConnection | null,
  peerId: string
): number | null {
  const [ping, setPing] = useState<number | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!pc) {
      setPing(null);
      return;
    }

    const checkStats = async () => {
      try {
        const stats = await pc.getStats();
        let currentRtt: number | null = null;

        stats.forEach((report) => {
          // Look for inbound RTP stats which contain round-trip time
          if (report.type === "inbound-rtp") {
            const roundTripTime = (report as any).roundTripTime;
            if (roundTripTime !== undefined && roundTripTime > 0) {
              // Convert to milliseconds
              currentRtt = Math.round(roundTripTime * 1000);
            }
          }
          // Fallback: check candidate-pair for currentRoundTripTime
          if (report.type === "candidate-pair") {
            const currentRoundTripTime = (report as any).currentRoundTripTime;
            if (
              currentRoundTripTime !== undefined &&
              currentRoundTripTime > 0 &&
              currentRtt === null
            ) {
              currentRtt = Math.round(currentRoundTripTime * 1000);
            }
          }
        });

        setPing(currentRtt);
      } catch (error) {
        console.error(`Error checking stats for peer ${peerId}:`, error);
      }
    };

    // Check stats every 500ms
    intervalRef.current = setInterval(checkStats, 500);

    // Initial check
    checkStats();

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [pc, peerId]);

  return ping;
}
