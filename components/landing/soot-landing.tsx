"use client";

import type { CSSProperties, MouseEvent } from "react";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Home,
  ListTodo,
  ShoppingCart,
  Sparkles,
  SunMedium,
  Target,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SootMascot } from "@/components/mascot/soot-mascot";

type AmbientSpeck = {
  id: number;
  left: number;
  size: number;
  duration: number;
  delay: number;
};

const pillars = [
  {
    title: "Routines humaines",
    description: "Matin, soir, hebdo: des séquences foyer claires plutôt qu'une pile de tâches.",
    icon: SunMedium,
  },
  {
    title: "Maison vivante",
    description: "Équipements, saisons, zones et moments de vie pilotent les actions utiles.",
    icon: Home,
  },
  {
    title: "Actions chorégraphiées",
    description: "Un seul bouton Ajouter, une sheet claire, des flux one-thumb sur mobile.",
    icon: Target,
  },
];

const onboardingSteps = [
  "Qui vit dans la maison",
  "Zones et espaces de vie",
  "Équipements à entretenir",
  "Dates utiles du foyer",
  "Style de routine (light / normal / carré)",
];

const roadmapColumns = [
  {
    title: "MVP SaaS",
    items: [
      "Assignations multi-utilisateurs foyer",
      "Routines + récurrence intelligente",
      "Entretien auto par équipement",
      "Notifications mobile + digest matin",
      "Export iCal minimum",
    ],
  },
  {
    title: "V2 Wow",
    items: [
      "Assistant semaine selon météo/saison",
      "Mode course collaboratif",
      "Budgets + reçus (progressif)",
      "Desktop app pour saisie rapide",
    ],
  },
  {
    title: "Différenciation premium",
    items: [
      "Templates de foyer prêts à l'emploi",
      "Quêtes saisonnières discrètes",
      "Guidage mascotte contextuel",
      "Abonnement par maison (owner principal)",
    ],
  },
];

export function SootLanding() {
  const [parallax, setParallax] = useState({ x: 0, y: 0 });
  const [ambientSpecks, setAmbientSpecks] = useState<AmbientSpeck[]>([]);

  useEffect(() => {
    let speckId = 0;

    const spawn = () => {
      setAmbientSpecks((previous) => [
        ...previous.slice(-5),
        {
          id: speckId++,
          left: 6 + Math.random() * 88,
          size: 4 + Math.round(Math.random() * 8),
          duration: 7 + Math.random() * 6,
          delay: Math.random() * 0.35,
        },
      ]);
    };

    const initialTimer = window.setTimeout(spawn, 4500);
    const interval = window.setInterval(spawn, 24000);

    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(interval);
    };
  }, []);

  const handleHeroMouseMove = (event: MouseEvent<HTMLElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const normalizedX = (event.clientX - rect.left) / rect.width - 0.5;
    const normalizedY = (event.clientY - rect.top) / rect.height - 0.5;
    setParallax({ x: normalizedX, y: normalizedY });
  };

  const resetParallax = () => setParallax({ x: 0, y: 0 });

  const parallaxStyle = {
    "--soot-parallax-x": `${parallax.x * 18}px`,
    "--soot-parallax-y": `${parallax.y * 14}px`,
  } as CSSProperties;

  return (
    <main className="soot-landing relative min-h-screen w-full overflow-x-clip overflow-y-visible text-[#1a271f]">
      <div className="soot-landing-grain" />
      {ambientSpecks.map((speck) => (
        <span
          key={speck.id}
          className="soot-ambient-speck"
          style={
            {
              left: `${speck.left}%`,
              width: `${speck.size}px`,
              height: `${speck.size}px`,
              animationDuration: `${speck.duration}s`,
              animationDelay: `${speck.delay}s`,
            } as CSSProperties
          }
        />
      ))}

      <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-7 sm:px-8 sm:py-10">
        <header className="soot-surface flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[#f9f1e2] px-4 py-3 sm:flex-nowrap sm:gap-4">
          <div className="flex items-center gap-3">
            <SootMascot mood="idle" className="h-10 w-10" />
            <div className="min-w-0">
              <p className="font-serif text-2xl font-semibold leading-none">Soot</p>
              <p className="truncate text-xs uppercase tracking-widest text-[#355244]">
                Forest Zen Home OS
              </p>
            </div>
          </div>
          <nav className="hidden items-center gap-5 text-sm text-[#2f473a] md:flex">
            <a href="#features" className="hover:text-[#1a271f]">
              Produit
            </a>
            <a href="#onboarding" className="hover:text-[#1a271f]">
              Onboarding
            </a>
            <a href="#roadmap" className="hover:text-[#1a271f]">
              Roadmap
            </a>
          </nav>
          <Button
            asChild
            variant="outline"
            className="shrink-0 rounded-full border-[#849f8a] bg-[#fbf7ee] text-[#1a271f] hover:bg-[#f2e9d9]"
          >
            <Link href="/login">Connexion</Link>
          </Button>
        </header>

        <section
          className="grid gap-6 lg:grid-cols-[1.08fr_0.92fr] lg:items-stretch"
          onMouseMove={handleHeroMouseMove}
          onMouseLeave={resetParallax}
        >
          <div className="soot-surface rounded-3xl bg-[#fbf3e3] p-6 sm:p-8">
            <p className="soot-chip mb-5 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs uppercase tracking-widest text-[#294134]">
              <Sparkles className="h-3.5 w-3.5" />
              Quotidien maison, pas todo-list
            </p>
            <h1 className="font-serif text-4xl font-semibold leading-tight sm:text-5xl">
              Une maison bien tenue, sans charge mentale.
            </h1>
            <p className="mt-5 max-w-2xl text-base text-[#334a3f] sm:text-lg">
              Soot orchestre routines, tâches, calendrier et achats dans une expérience mobile-first
              chaleureuse. Un abonnement par maison, géré par le propriétaire principal.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Button asChild size="lg" className="rounded-full bg-[#1f3224] text-[#f6eddb] hover:bg-[#17281d]">
                <Link href="/login" className="inline-flex items-center gap-2">
                  Créer mon foyer
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="rounded-full border-[#7f9a86] bg-[#fcf7ef] text-[#203127] hover:bg-[#f1e8da]"
              >
                <a href="#onboarding">Voir le parcours 5 min</a>
              </Button>
            </div>
          </div>

          <div className="relative" style={parallaxStyle}>
            <div className="soot-parallax-layer soot-parallax-layer--back" />
            <Card className="soot-surface relative z-10 h-full rounded-3xl border-[#c7b08a] bg-[#f6efdf]/95 text-[#203126]">
              <CardHeader className="space-y-4">
                <CardTitle className="font-serif text-2xl text-[#1f2d24]">Soot Guide</CardTitle>
                <div className="rounded-2xl border border-[#d4c3a7] bg-[#fff9ef] p-3">
                  <div className="flex items-start gap-3">
                    <SootMascot mood="working" className="h-10 w-10 shrink-0" />
                    <p className="text-sm text-[#31493c]">
                      5 minutes de questions, puis génération immédiate: routines, tâches réalistes,
                      dates utiles et liste de base.
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid gap-2 text-sm text-[#31493c]">
                  <p className="inline-flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-[#4f7652]" />
                    Focus du jour + routines + à venir 7 jours.
                  </p>
                  <p className="inline-flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-[#4f7652]" />
                    Équipements reliés à l’entretien automatique.
                  </p>
                  <p className="inline-flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-[#4f7652]" />
                    Ajouter en un geste (tâche / rendez-vous / dépense / achat).
                  </p>
                </div>
              </CardContent>
            </Card>
            <div className="soot-parallax-layer soot-parallax-layer--front" />
          </div>
        </section>

        <section id="features" className="grid gap-4 md:grid-cols-3">
          {pillars.map((pillar) => (
            <Card
              key={pillar.title}
              className="soot-surface rounded-2xl border-[#d2bea0] bg-[#fbf4e7] text-[#203126]"
            >
              <CardHeader className="space-y-3 pb-2">
                <div className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#c9b48f] bg-[#f2e7d3] text-[#304237]">
                  <pillar.icon className="h-4 w-4" />
                </div>
                <CardTitle className="font-serif text-xl text-[#1f2d24]">{pillar.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-[#375247]">{pillar.description}</p>
              </CardContent>
            </Card>
          ))}
        </section>

        <section id="onboarding" className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
          <Card className="soot-surface rounded-3xl border-[#cfb99a] bg-[#fcf7ee] text-[#203126]">
            <CardHeader>
              <CardTitle className="font-serif text-3xl text-[#1f2d24]">Onboarding Soot Guide (5 min)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <ol className="grid gap-3">
                {onboardingSteps.map((step, index) => (
                  <li key={step} className="flex items-start gap-3 rounded-xl border border-[#d8c9ad] bg-[#fffaf1] p-3">
                    <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#2f4134] text-xs font-semibold text-[#f1e7d4]">
                      {index + 1}
                    </span>
                    <span className="text-sm text-[#364f43]">{step}</span>
                  </li>
                ))}
              </ol>
              <div className="rounded-2xl border border-[#c9b48f] bg-[#f3e8d2] p-4">
                <p className="text-sm font-medium text-[#2a3c30]">
                  Résultat auto dès la fin:
                </p>
                <p className="mt-1 text-sm text-[#364f43]">
                  15 tâches récurrentes, 3 routines, calendrier dates utiles, 1 liste d’achats de base.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="soot-surface rounded-3xl border-[#cdb595] bg-[#f8f0df] text-[#203126]">
            <CardHeader>
              <CardTitle className="font-serif text-3xl text-[#1f2d24]">Vue “Aujourd’hui” signature</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3">
                <div className="rounded-xl border border-[#d8c7ac] bg-[#fff8ee] p-3">
                  <p className="text-xs uppercase tracking-widest text-[#3e5a4b]">Focus du jour</p>
                  <p className="mt-1 text-sm text-[#334b3f]">3 actions maxi, claires et priorisées.</p>
                </div>
                <div className="rounded-xl border border-[#d8c7ac] bg-[#fff8ee] p-3">
                  <p className="text-xs uppercase tracking-widest text-[#3e5a4b]">Routines</p>
                  <p className="mt-1 text-sm text-[#334b3f]">Matin / soir / hebdo visibles au même endroit.</p>
                </div>
                <div className="rounded-xl border border-[#d8c7ac] bg-[#fff8ee] p-3">
                  <p className="text-xs uppercase tracking-widest text-[#3e5a4b]">À venir 7 jours</p>
                  <p className="mt-1 text-sm text-[#334b3f]">Échéances prêtes pour la semaine.</p>
                </div>
              </div>
              <div className="rounded-2xl border border-[#d2bc9b] bg-[#f2e5cd] p-4">
                <p className="inline-flex items-center gap-2 text-sm text-[#314339]">
                  <ListTodo className="h-4 w-4" />
                  <CalendarClock className="h-4 w-4" />
                  <ShoppingCart className="h-4 w-4" />
                  <Wrench className="h-4 w-4" />
                </p>
                <p className="mt-2 text-sm text-[#365144]">
                  Un bouton “Ajouter” central ouvre une sheet multi-choix, optimisée one-thumb.
                </p>
              </div>
            </CardContent>
          </Card>
        </section>

        <section id="roadmap" className="grid gap-4 md:grid-cols-3">
          {roadmapColumns.map((column, index) => (
            <Card
              key={column.title}
              className={`soot-surface rounded-2xl text-[#203126] ${
                index === 0 ? "border-[#c6b08a] bg-[#f5ebd8]" : "border-[#d7c8ae] bg-[#fbf5e9]"
              }`}
            >
              <CardHeader>
                <CardTitle className="font-serif text-2xl text-[#1f2d24]">{column.title}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {column.items.map((item) => (
                  <p key={item} className="text-sm text-[#365145]">
                    • {item}
                  </p>
                ))}
              </CardContent>
            </Card>
          ))}
        </section>

        <section className="soot-surface rounded-3xl border border-[#baa786] bg-[#efe2cb] p-6 text-center text-[#203126] sm:p-8">
          <div className="mx-auto mb-3 flex w-fit items-center gap-2">
            <SootMascot mood="happy" className="h-9 w-9" />
            <SootMascot mood="idle" className="h-8 w-8 opacity-80" />
          </div>
          <h2 className="font-serif text-3xl">Prêt à passer en mode foyer organisé ?</h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm text-[#334c40] sm:text-base">
            Commence gratuitement, configure ton foyer en quelques minutes et laisse Soot faire le
            gros du cadrage quotidien.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg" className="rounded-full bg-[#1f3224] text-[#f6eddb] hover:bg-[#17281d]">
              <Link href="/login">Démarrer avec Soot</Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="rounded-full border-[#829b87] bg-[#f9f2e4] text-[#203127] hover:bg-[#f0e5d4]"
            >
              <a href="#features">Explorer le produit</a>
            </Button>
          </div>
        </section>
      </div>
    </main>
  );
}
