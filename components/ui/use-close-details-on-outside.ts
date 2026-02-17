"use client";

import { useEffect, type RefObject } from "react";

export function useCloseDetailsOnOutside(
  detailsRef: RefObject<HTMLDetailsElement | null>
) {
  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const details = detailsRef.current;
      if (!details || !details.hasAttribute("open")) return;
      if (event.target instanceof Node && details.contains(event.target)) return;
      details.removeAttribute("open");
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      const details = detailsRef.current;
      if (!details || !details.hasAttribute("open")) return;
      details.removeAttribute("open");
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [detailsRef]);
}

