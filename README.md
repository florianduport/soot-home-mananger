# Homanager

Outil de gestion des tâches, projets et informations de la maison.

## Prérequis

- Docker
- Docker Compose

## Démarrage rapide (tout en Docker)

```bash
docker compose up --build
```

Ouvre `http://localhost:3005`.

## Exposer l'app via Cloudflare Tunnel (DNS + accès Internet)

Objectif: exposer `app:3005` sur un sous-domaine Cloudflare (ex: `homanager-test.ton-domaine.com`).

### Option A - test immédiat (URL temporaire `trycloudflare.com`)

```bash
docker compose --profile cloudflared-quick up --build -d
docker compose logs -f cloudflared-quick
```

Cloudflared affichera une URL publique temporaire qui redirige vers l'app sur le port `3005`.

### Option B - DNS fixe (sous-domaine Cloudflare)

1. Créer un tunnel et le lier à un enregistrement DNS (une fois):

```bash
cloudflared tunnel login
cloudflared tunnel create homanager-test
cloudflared tunnel route dns homanager-test homanager-test.ton-domaine.com
cloudflared tunnel token homanager-test
```

2. Renseigner les variables (dans `.env`):

```env
NEXTAUTH_URL="https://homanager-test.ton-domaine.com"
CLOUDFLARED_TUNNEL_TOKEN="<token_retourne_par_cloudflared_tunnel_token>"
```

3. Lancer l'app + tunnel:

```bash
docker compose --profile cloudflared up --build -d
```

4. Vérifier les logs du tunnel:

```bash
docker compose logs -f cloudflared
```

## Connexion par lien magique

Si aucun serveur email n’est pas configuré, les liens magiques et invitations sont affichés dans les logs du conteneur `app`.

```bash
docker compose logs -f app
```

Pour configurer un SMTP, renseigne dans `.env` ou dans `docker-compose.yml` :

- `EMAIL_SERVER_HOST`
- `EMAIL_SERVER_PORT`
- `EMAIL_SERVER_USER`
- `EMAIL_SERVER_PASSWORD`
- `EMAIL_FROM`

## Suggestions de tâches (OpenAI)

Renseigne la clé dans `.env` ou dans `docker-compose.yml` :

- `OPENAI_API_KEY`
- `OPENAI_MODEL` (ex: `gpt-4o-mini`)
- `OPENAI_SHOPPING_MODEL` (optionnel, sinon `OPENAI_MODEL`)
- `OPENAI_BUDGET_MODEL` (optionnel, extraction des tickets/factures/devis)

## Dates importantes (anniversaires, événements)

Après mise à jour, applique le schéma Prisma:

```bash
npm run db:push
```

Endpoints API:

- `GET /api/important-dates` (option: `houseId`, et `from` + `to` au format `YYYY-MM-DD`)
- `POST /api/important-dates`
- `GET /api/important-dates/:importantDateId`
- `PATCH /api/important-dates/:importantDateId`
- `DELETE /api/important-dates/:importantDateId`

## V1 - Fonctionnalités incluses

- Authentification par lien magique
- Création de maison et zones/catégories par défaut
- Création de tâches avec récurrence et rappels
- Génération automatique des occurrences récurrentes
- Suggestions de tâches (OpenAI)
- Module “dates importantes” (anniversaires, commémorations, événements)
- Gestion basique des animaux et personnes non-utilisatrices
- Vue calendrier globale
- Navigation multi-pages avec sidebar
- Budgets mensuels (revenus/dépenses ponctuels + récurrents)
- Conversion des articles de listes d'achats en dépenses réelles
- Import de justificatifs avec extraction automatique des dépenses (OpenAI)
