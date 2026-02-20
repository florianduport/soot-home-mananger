# Homanager (Soot)

Application Next.js pour organiser la vie de la maison: taches, projets, calendrier, achats, budgets, prestataires, equipements et automatisations assistees.

## Sommaire

1. [Vision produit](#vision-produit)
2. [Stack technique](#stack-technique)
3. [Fonctionnalites](#fonctionnalites)
4. [Demarrage rapide](#demarrage-rapide)
5. [Configuration](#configuration)
6. [Scripts utiles](#scripts-utiles)
7. [i18n partout](#i18n-partout)
8. [Securite et qualite du code](#securite-et-qualite-du-code)
9. [Tests E2E Playwright](#tests-e2e-playwright)
10. [Base de donnees et Prisma](#base-de-donnees-et-prisma)
11. [Documentation vivante](#documentation-vivante)
12. [Depannage](#depannage)

## Vision produit

Soot aide un foyer a garder une organisation stable sans surcharge mentale:

- routines et taches recurrentes,
- suivi calendrier et dates importantes,
- budgets et justificatifs,
- listes d'achats et depenses,
- gestion des equipements et prestataires,
- assistant IA pour suggestions et support conversationnel.

## Stack technique

- `Next.js 16` (App Router, Server Actions)
- `React 19`
- `TypeScript`
- `Prisma` + PostgreSQL
- `next-auth` (magic link email)
- `Tailwind CSS`
- `Playwright` pour les tests E2E

## Fonctionnalites

- Authentification par lien magique.
- Onboarding maison (membres, zones, categories, base de taches).
- Gestion des taches, recurrence et rappels.
- Calendrier global et dates importantes.
- Budgets (entrees/sorties) + documents.
- Listes d'achats.
- Gestion projets, equipements, prestataires.
- Notifications in-app.
- i18n (fr, en, es) avec detection auto et selection manuelle.

## Demarrage rapide

### Prerequis

- `Node.js >= 20`
- `npm`
- `PostgreSQL` local, ou Docker

### Option A: local (recommande pour dev)

```bash
npm install
cp .env.example .env
npm run db:push
npx prisma generate
npm run dev
```

Application: `http://localhost:3005` (ou port configure).

### Option B: Docker

```bash
docker compose up --build
```

## Configuration

Variables principales (`.env`):

- `DATABASE_URL`
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`
- `EMAIL_SERVER_HOST`
- `EMAIL_SERVER_PORT`
- `EMAIL_SERVER_USER`
- `EMAIL_SERVER_PASSWORD`
- `EMAIL_FROM`
- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `OPENAI_AGENT_MODEL`
- `OPENAI_CONVERSATION_TITLE_MODEL`
- `OPENAI_SHOPPING_MODEL`
- `OPENAI_BUDGET_MODEL`

Si SMTP n'est pas configure, les liens magiques sont affiches dans les logs.

## Scripts utiles

- `npm run dev`: lance l'app en developpement.
- `npm run lint`: lint ESLint.
- `npm run build`: build de production + verifications TypeScript.
- `npm run test:e2e`: lance les tests E2E Playwright.
- `npm run test:e2e:ui`: mode UI Playwright.
- `npm run check`: pipeline complet `lint + build + e2e`.
- `npm run db:push`: applique le schema Prisma a la base.
- `npm run db:migrate`: cree/applique une migration en dev.
- `npm run db:studio`: ouvre Prisma Studio.

## i18n partout

Le projet impose i18n sur tous les nouveaux ecrans:

- Source de verite langue: `lib/i18n/language.ts`
- Traduction dynamique: `lib/i18n/translate.ts`
- Provider global: `components/i18n/i18n-provider.tsx`
- Switch langue: landing + reglages

Regles:

- Toute nouvelle copie UI doit etre traduisible.
- Ne pas hardcoder de texte non couvert par le flux i18n.
- Verifier le rendu minimum en `fr` et `en` avant merge.

## Securite et qualite du code

Qualite minimale avant merge:

```bash
npm run check
```

Cela valide:

- lint (`eslint`)
- build production (`next build`)
- tests E2E (`playwright`)

Pratiques recommandees:

- garder les dependances a jour,
- eviter les secrets en dur,
- valider les entrees cote serveur,
- limiter les permissions des actions serveur,
- traiter les erreurs de schema/migration avant release.

## Tests E2E Playwright

Emplacement des specs:

- `tests/e2e/smoke.spec.ts`
- `tests/e2e/public-pages.spec.ts`

Configuration:

- `playwright.config.ts`
- artefacts: `output/playwright/`

Execution locale:

```bash
npm run test:e2e
```

Le web server de test est lance automatiquement sur un port dedie pour eviter les conflits.

## Base de donnees et Prisma

Apres changement du schema (`prisma/schema.prisma`):

```bash
npm run db:push
npx prisma generate
```

Important:

- Le module notifications utilise maintenant le modele `Notification`.
- Les heures silencieuses et l'escalade utilisent le modele `NotificationPreference` + champs de tache (`allowDuringQuietHours`, `escalationDelayHours`, `escalationDisabled`, `assignedAt`).
- Appliquer le schema avant de tester cette fonctionnalite.

## Documentation vivante

Toute PR qui modifie comportement, architecture, scripts ou configuration doit mettre a jour:

- `README.md`
- `AGENTS.md` (si les regles de contribution evoluent)
- eventuelle doc de composant/fonctionnalite concernee

Checklist doc minimale pour une PR:

- fonctionnalite decrite,
- commandes de verification indiquees,
- impact env/db mentionne,
- limitations connues notees.

## Depannage

### Echec `build` sur delegates Prisma manquants

```bash
npx prisma generate
```

### Erreur table/colonne manquante en runtime

```bash
npm run db:push
```

### E2E KO (port deja pris)

- verifier les processus Next deja en cours,
- relancer `npm run test:e2e`.

### Lien magique non recu

- verifier SMTP,
- sinon lire les logs applicatifs pour recuperer le lien en dev.
