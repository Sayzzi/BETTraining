# BETTraining

Application web d'entraînement d'endurance cérébrale (Brain Endurance Training), avec des séances personnalisées et un suivi complet. Le vocabulaire du domaine est dans `GLOSSARY.md`, les décisions d'architecture dans `docs/adr/` et la recherche dans `docs/research/`.

Stack : Next.js 16 (full-stack), PostgreSQL avec Drizzle, Better Auth, le tout dans Docker (voir `docs/adr/0001-nextjs-fullstack-postgres-docker.md`).

## Lancer l'application avec Docker

Prérequis : Docker Desktop démarré.

```bash
cp .env.example .env
# Remplace BETTER_AUTH_SECRET par une vraie valeur : openssl rand -base64 32
docker compose up -d --build
```

Docker démarre PostgreSQL, applique les migrations, puis sert l'application sur http://localhost:3000.

## Développer en local

Prérequis : Node 26 et pnpm 11.

```bash
pnpm install
docker compose up -d db   # PostgreSQL seul, sur le port 5432
pnpm db:migrate
pnpm dev                  # http://localhost:3000
```

Après une modification de `src/db/schema.ts`, génère la migration avec `pnpm db:generate`.

## Tests

| Commande | Ce qu'elle teste |
|---|---|
| `pnpm test` | Tests unitaires : code pur, sans base de données. |
| `pnpm db:test:up` puis `pnpm test:int` | Tests d'intégration contre une base PostgreSQL de test (port 5433), remise à zéro à chaque lancement. |
| `pnpm db:test:up` puis `pnpm test:e2e` | Parcours de bout en bout avec Playwright (ordinateur et mobile), sur un serveur de dev au port 3100 relié à la base de test. Lance `pnpm exec playwright install chromium` la première fois. |

`pnpm lint` et `pnpm typecheck` vérifient le style et les types.
