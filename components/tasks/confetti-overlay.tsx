"use client";

import { useEffect, useState } from "react";

type Piece = {
  id: number;
  left: number;
  delay: number;
  duration: number;
  hue: number;
};

export function ConfettiOverlay() {
  const [pieces, setPieces] = useState<Piece[]>([]);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const trigger = () => {
      const generated = Array.from({ length: 80 }).map((_, index) => ({
        id: index,
        left: Math.random() * 100,
        delay: Math.random() * 0.4,
        duration: 2 + Math.random(),
        hue: Math.floor(Math.random() * 360),
      }));
      setPieces(generated);
      setVisible(true);
      window.setTimeout(() => setVisible(false), 2800);
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
          className="confetti-piece"
          style={{
            left: `${piece.left}%`,
            animationDelay: `${piece.delay}s`,
            animationDuration: `${piece.duration}s`,
            backgroundColor: `hsl(${piece.hue} 80% 60%)`,
          }}
        />
      ))}
    </div>
  );
}
