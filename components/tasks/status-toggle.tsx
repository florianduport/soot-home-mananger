"use client";

import { useMemo, useRef } from "react";
import { updateTaskStatus } from "@/app/actions";

export function StatusToggle({
  taskId,
  done,
  className,
}: {
  taskId: string;
  done: boolean;
  className?: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const messages = useMemo(
    () => [
      "Bravo !",
      "Tâche accomplie !",
      "Bien joué !",
      "Mission réussie !",
      "Excellent boulot !",
      "C’est fait !",
      "Super, c’est fait !",
      "Tu gères !",
      "GG !",
      "Top !",
      "Nickel !",
      "Parfait !",
      "Ça, c’est fait.",
      "Encore une de faite !",
      "Belle avance !",
      "Petit pas, grande victoire.",
      "Yes !",
      "Ça roule !",
      "Productif !",
      "Tu avances bien !",
      "Formidable !",
      "On continue !",
      "Et bim !",
      "Coché !",
      "Masterclass.",
      "Clean !",
      "Bravo, champion !",
      "Excellent !",
      "Objectif rempli.",
      "Génial !",
      "Top chrono !",
      "Rien ne t’arrête !",
      "Comme un pro.",
      "Bien vu !",
      "Tu assures !",
      "Splendide !",
      "Ça avance !",
      "On est bons !",
      "Solide !",
      "Encore une victoire !",
      "Tu marques des points !",
      "C’est carré !",
      "Tâche validée !",
      "Propre et net !",
      "C’est plié !",
      "Respect !",
      "Ça c’est fait.",
      "Tu es en feu !",
      "Ça sent la victoire.",
      "Un pas de plus !",
      "Objectif coché !",
      "Focus +1.",
      "Momentum !",
      "Bien propre.",
      "On lâche rien.",
      "Félicitations !",
      "GG WP.",
      "Score !",
      "Pas mal du tout !",
    ],
    []
  );

  const triggerCelebrate = () => {
    const randomMessage = messages[Math.floor(Math.random() * messages.length)];
    const payload = {
      taskId,
      message: randomMessage,
      timestamp: Date.now(),
    };
    try {
      localStorage.setItem(
        `taskCelebration:${taskId}`,
        JSON.stringify(payload)
      );
      localStorage.setItem("taskCelebration:last", JSON.stringify(payload));
    } catch {
      // ignore storage errors
    }
    window.dispatchEvent(
      new CustomEvent("task:completed", {
        detail: payload,
      })
    );
  };

  return (
    <form
      ref={formRef}
      action={updateTaskStatus}
      className={`relative inline-flex items-center justify-center ${className ?? ""}`}
    >
      <input type="hidden" name="taskId" value={taskId} />
      <input
        id={`task-${taskId}`}
        type="checkbox"
        name="status"
        value="DONE"
        defaultChecked={done}
        className="h-4 w-4 cursor-pointer accent-foreground"
        title={done ? "Décoche comme non terminé" : "Cocher comme terminé"}
        onChange={(event) => {
          formRef.current?.requestSubmit();
          if (event.target.checked) {
            triggerCelebrate();
          }
        }}
      />
    </form>
  );
}
