"use client";

import { useEffect, useState } from "react";

type Piece = {
  id: number;
  left: number;
  top: number;
  delay: number;
  duration: number;
  size: number;
};

export function ConfettiOverlay() {
  const [pieces, setPieces] = useState<Piece[]>([]);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const trigger = () => {
      const generated = Array.from({ length: 22 }).map((_, index) => ({
        id: index,
        left: 35 + Math.random() * 30,
        top: 38 + Math.random() * 18,
        delay: Math.random() * 0.16,
        duration: 0.75 + Math.random() * 0.45,
        size: 4 + Math.round(Math.random() * 6),
      }));
      setPieces(generated);
      setVisible(true);
      window.setTimeout(() => setVisible(false), 1200);
    };
    const handler = (event: Event) => {
      const detail = (event as CustomEvent).detail as { timestamp?: number };
      if (!detail?.timestamp) return;
      trigger();
    };
    window.addEventListener("task:completed", handler as EventListener);
    try {
      const raw = localStorage.getItem("taskCelebration:last");
      if (raw) {
        const parsed = JSON.parse(raw) as { timestamp?: number };
        if (parsed.timestamp && Date.now() - parsed.timestamp < 3000) {
          trigger();
        }
      }
    } catch {
      // ignore storage errors
    }
    return () => window.removeEventListener("task:completed", handler as EventListener);
  }, []);

  if (!visible) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {pieces.map((piece) => (
        <span
          key={piece.id}
          className="soot-puff"
          style={{
            left: `${piece.left}%`,
            top: `${piece.top}%`,
            width: `${piece.size}px`,
            height: `${piece.size}px`,
            animationDelay: `${piece.delay}s`,
            animationDuration: `${piece.duration}s`,
          }}
        />
      ))}
    </div>
  );
}
