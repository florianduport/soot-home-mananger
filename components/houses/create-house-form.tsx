"use client";

import { useMemo, useState } from "react";
import { Bot, Send, Sparkles } from "lucide-react";
import { completeHouseOnboarding, createHouse } from "@/app/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type OnboardingQuestion = {
  id: "name" | "people" | "zones" | "projects" | "tasks";
  title: string;
  prompt: string;
  placeholder: string;
  helper: string;
  required?: boolean;
  multiline?: boolean;
};

const ONBOARDING_QUESTIONS: OnboardingQuestion[] = [
  {
    id: "name",
    title: "Maison",
    prompt: "Comment s'appelle votre maison ?",
    placeholder: "Ex: Maison Duport",
    helper: "Nom visible partout dans l'app.",
    required: true,
  },
  {
    id: "people",
    title: "Membres",
    prompt: "Qui vit dans la maison ?",
    placeholder: "Ex: Florian (parent), Emma (enfant)",
    helper: "Sépare par des virgules. Tu peux ajouter le role entre parenthèses.",
    required: true,
    multiline: true,
  },
  {
    id: "zones",
    title: "Zones",
    prompt: "Quelles sont les zones principales a suivre ?",
    placeholder: "Ex: Cuisine, Salon, Garage, Terrasse",
    helper: "Intérieur et Jardin sont déjà inclus.",
    multiline: true,
  },
  {
    id: "projects",
    title: "Projets",
    prompt: "Quels projets voulez-vous lancer d'abord ?",
    placeholder: "Ex: Refaire la salle de bain, Organiser le cellier",
    helper: "Ajoute 1 a 3 projets pour demarrer.",
    multiline: true,
  },
  {
    id: "tasks",
    title: "Premières taches",
    prompt: "Quelles sont les premières taches a creer maintenant ?",
    placeholder: "Ex: Acheter ampoules, Planifier menage semaine, Trier les papiers",
    helper: "Ajoute 2 a 5 taches separees par virgule ou retour a la ligne.",
    required: true,
    multiline: true,
  },
];

type CreateHouseFormProps = {
  userDisplayName?: string | null;
  existingHouseId?: string;
  existingHouseName?: string;
};

type Answers = Record<OnboardingQuestion["id"], string>;

function countItems(value: string) {
  return value
    .split(/[\n,;]+/g)
    .map((item) => item.trim())
    .filter(Boolean).length;
}

export function CreateHouseForm({
  userDisplayName,
  existingHouseId,
  existingHouseName,
}: CreateHouseFormProps) {
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Answers>({
    name: existingHouseName?.trim() || "",
    people: userDisplayName?.trim() || "",
    zones: "",
    projects: "",
    tasks: "",
  });
  const formAction = existingHouseId ? completeHouseOnboarding : createHouse;
  const isExistingHouse = Boolean(existingHouseId);

  const isCompleted = step >= ONBOARDING_QUESTIONS.length;
  const activeQuestion = isCompleted ? null : ONBOARDING_QUESTIONS[step];
  const progressPercent = Math.min(
    100,
    Math.round((step / ONBOARDING_QUESTIONS.length) * 100)
  );

  const summary = useMemo(
    () => ({
      people: countItems(answers.people),
      zones: countItems(answers.zones),
      projects: countItems(answers.projects),
      tasks: countItems(answers.tasks),
    }),
    [answers.people, answers.projects, answers.tasks, answers.zones]
  );

  function updateAnswer(questionId: OnboardingQuestion["id"], value: string) {
    if (error) {
      setError(null);
    }
    setAnswers((current) => ({ ...current, [questionId]: value }));
  }

  function canMoveForward() {
    if (!activeQuestion) return false;
    if (!activeQuestion.required) return true;
    return answers[activeQuestion.id].trim().length > 0;
  }

  function continueToNextQuestion() {
    if (!activeQuestion) return;
    const value = answers[activeQuestion.id].trim();
    if (activeQuestion.required && value.length === 0) {
      setError("Cette réponse est requise pour continuer.");
      return;
    }

    setError(null);
    setStep((current) => current + 1);
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-[#f5ebd8] via-[#efe0c2] to-[#dfd0b5] p-4 sm:p-6">
      <div className="mx-auto flex min-h-[calc(100vh-2rem)] max-w-4xl items-center justify-center sm:min-h-[calc(100vh-3rem)]">
        <Card className="w-full border-[#d2bf9f] bg-[#fbf4e5]/95 shadow-xl">
          <CardHeader className="gap-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className="font-serif text-3xl text-[#2e3b2f]">
                  {isExistingHouse ? "Finaliser l'onboarding" : "Onboarding maison"}
                </CardTitle>
                <CardDescription className="text-[#556251]">
                  {isExistingHouse
                    ? "Termine les 5 questions pour activer ton espace."
                    : "5 questions rapides pour arriver sur une app déjà prête."}
                </CardDescription>
              </div>
              <Badge variant="outline" className="border-[#ccb693] bg-[#f3e6ce] text-[#3b4a3e]">
                {Math.min(step + 1, ONBOARDING_QUESTIONS.length)}/
                {ONBOARDING_QUESTIONS.length}
              </Badge>
            </div>
            <div className="h-2 rounded-full bg-[#ead8bb]">
              <div
                className="h-2 rounded-full bg-[#7f956b] transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="max-h-[55vh] space-y-3 overflow-y-auto rounded-2xl border border-[#dec9a6] bg-[#fff8eb] p-4">
              <div className="flex justify-start">
                <div className="max-w-[90%] rounded-2xl border border-[#d7c29d] bg-[#fbf4e5] px-3 py-2 text-sm text-[#2e3b2f] shadow-sm">
                  <p className="mb-1 flex items-center gap-1 text-[11px] text-[#6c7a67]">
                    <Bot className="h-3 w-3" />
                    Soot Guide
                  </p>
                  <p>
                    Je te guide pour créer ta maison avec les premiers éléments utiles
                    (membres, zones, projets, taches).
                  </p>
                </div>
              </div>

              {ONBOARDING_QUESTIONS.map((question, index) => {
                const hasAnswer = answers[question.id].trim().length > 0;
                const showQuestion = index <= step;

                if (!showQuestion) return null;

                return (
                  <div key={question.id} className="space-y-2">
                    <div className="flex justify-start">
                      <div className="max-w-[90%] rounded-2xl border border-[#d7c29d] bg-[#f9f0dc] px-3 py-2 text-sm text-[#2e3b2f] shadow-sm">
                        <p className="mb-1 flex items-center gap-1 text-[11px] text-[#6c7a67]">
                          <Sparkles className="h-3 w-3" />
                          Question {index + 1} - {question.title}
                        </p>
                        <p>{question.prompt}</p>
                      </div>
                    </div>
                    {hasAnswer || (index < step && !question.required) ? (
                      <div className="flex justify-end">
                        <div className="max-w-[90%] rounded-2xl bg-[#2f3b33] px-3 py-2 text-sm text-[#f4f7f1] shadow-sm">
                          <p className="whitespace-pre-wrap break-words">
                            {hasAnswer ? answers[question.id] : "Passe"}
                          </p>
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })}

              {isCompleted ? (
                <div className="rounded-xl border border-[#d6c19f] bg-[#f7ecda] p-3 text-sm text-[#2f3b33]">
                  <p className="font-semibold">Recap avant creation</p>
                  <p className="mt-1">Maison: {answers.name}</p>
                  <p>Membres: {summary.people}</p>
                  <p>Zones: {summary.zones}</p>
                  <p>Projets: {summary.projects}</p>
                  <p>Taches: {summary.tasks}</p>
                </div>
              ) : null}
            </div>

            {isCompleted ? (
              <div className="space-y-3">
                <form action={formAction} className="space-y-3">
                  {existingHouseId ? (
                    <input type="hidden" name="houseId" value={existingHouseId} />
                  ) : null}
                  <input type="hidden" name="name" value={answers.name} />
                  <input type="hidden" name="onboardingPeople" value={answers.people} />
                  <input type="hidden" name="onboardingZones" value={answers.zones} />
                  <input type="hidden" name="onboardingProjects" value={answers.projects} />
                  <input type="hidden" name="onboardingTasks" value={answers.tasks} />
                  <Button type="submit" className="w-full">
                    {isExistingHouse
                      ? "Terminer l'onboarding et ouvrir l'app"
                      : "Creer la maison et ouvrir l'app"}
                  </Button>
                </form>

                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => setStep(ONBOARDING_QUESTIONS.length - 1)}
                >
                  Modifier la derniere reponse
                </Button>
              </div>
            ) : activeQuestion ? (
              <div className="space-y-3 rounded-xl border border-[#d8c29f] bg-[#f9f1df] p-3">
                {activeQuestion.multiline ? (
                  <Textarea
                    autoFocus
                    rows={3}
                    value={answers[activeQuestion.id]}
                    onChange={(event) =>
                      updateAnswer(activeQuestion.id, event.target.value)
                    }
                    placeholder={activeQuestion.placeholder}
                  />
                ) : (
                  <Input
                    autoFocus
                    value={answers[activeQuestion.id]}
                    onChange={(event) =>
                      updateAnswer(activeQuestion.id, event.target.value)
                    }
                    onKeyDown={(event) => {
                      if (event.key !== "Enter") return;
                      event.preventDefault();
                      continueToNextQuestion();
                    }}
                    placeholder={activeQuestion.placeholder}
                  />
                )}

                <p className="text-xs text-[#687564]">{activeQuestion.helper}</p>

                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="add"
                    className="gap-2"
                    onClick={continueToNextQuestion}
                  >
                    Continuer
                    <Send className="h-4 w-4" />
                  </Button>
                  {!activeQuestion.required ? (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={continueToNextQuestion}
                    >
                      Passer
                    </Button>
                  ) : null}
                </div>
                {error ? <p className="text-xs text-destructive">{error}</p> : null}
                {!canMoveForward() && activeQuestion.required ? (
                  <p className="text-xs text-[#7f705a]">
                    Reponse requise avant de continuer.
                  </p>
                ) : null}
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
