# Toknex Leaderboard API

Small Fastify API for a PostgreSQL leaderboard source. It exposes only the
fields required by the frontend: `rank`, `wallet`, and `total_deposited_usd`.

## Required database shape

Point `LEADERBOARD_SOURCE` at a table or view with these columns:

```sql
wallet text
total_deposited_usd numeric
```

For good read performance, create an index on the source table:

```sql
CREATE INDEX CONCURRENTLY leaderboard_total_wallet_idx
ON leaderboard (total_deposited_usd DESC, wallet ASC);
```

## Run locally

```bash
cp .env.example .env
npm install
npm run dev
```

## Run in Docker

```bash
cp .env.example .env
docker compose up --build
```

Endpoints:

- `GET /health`
- `GET /v1/leaderboard?limit=50&offset=0`

The legacy-friendly `GET /leaderboard` route serves the same response.
