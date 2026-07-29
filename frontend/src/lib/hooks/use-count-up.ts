import { useEffect, useRef, useState } from "react";

const DURATION_MS = 600;

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function useCountUp(target: number) {
  const [value, setValue] = useState(target);
  const previousTarget = useRef(target);
  const frameRef = useRef<number>();

  useEffect(() => {
    if (!Number.isFinite(target) || prefersReducedMotion()) {
      setValue(target);
      previousTarget.current = target;
      return;
    }

    const start = previousTarget.current;
    const delta = target - start;
    if (delta === 0) {
      return;
    }

    const startTime = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - startTime) / DURATION_MS);
      const eased = 1 - (1 - progress) ** 3;
      setValue(start + delta * eased);
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(tick);
      } else {
        previousTarget.current = target;
      }
    };

    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, [target]);

  return value;
}
