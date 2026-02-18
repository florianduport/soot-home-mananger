"use client";

type SootMood = "idle" | "happy" | "sleepy" | "working";

const moodToAsset: Record<SootMood, string> = {
  idle: "/mascot/soot-idle.svg",
  happy: "/mascot/soot-happy.svg",
  sleepy: "/mascot/soot-sleepy.svg",
  working: "/mascot/soot-working.svg",
};

const moodToLabel: Record<SootMood, string> = {
  idle: "Mascotte Soot",
  happy: "Mascotte Soot contente",
  sleepy: "Mascotte Soot somnolente",
  working: "Mascotte Soot en action",
};

export function SootMascot({
  mood = "idle",
  className = "",
}: {
  mood?: SootMood;
  className?: string;
}) {
  const animationClass =
    mood === "happy"
      ? "soot-bounce"
      : mood === "working"
        ? "soot-tilt"
        : "soot-breathe";

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={moodToAsset[mood]}
      alt={moodToLabel[mood]}
      className={`soot-mascot ${animationClass} ${className}`.trim()}
      loading="lazy"
      decoding="async"
    />
  );
}
