FROM node:20-alpine AS base

RUN apk add --no-cache postgresql-client
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
EXPOSE 3005

CMD ["sh", "-c", "until pg_isready -h db -U postgres; do sleep 1; done; npx prisma db push; npm run dev -- -H 0.0.0.0 -p 3005"]
