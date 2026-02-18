FROM node:20-alpine AS base

RUN apk add --no-cache postgresql-client
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
EXPOSE 3005

# Si prisma db push échoue (ex: doublons HouseMember.userId), le serveur ne démarre pas.
# En cas d'erreur "unique constraint" sur HouseMember.userId, exécuter une fois dans le conteneur ou en local (avec la même DATABASE_URL) : npm run db:fix-house-member-duplicates
CMD ["sh", "-c", "until pg_isready -h db -U postgres; do sleep 1; done && npx prisma db push --accept-data-loss && npm run dev -- -H 0.0.0.0 -p 3005"]
