import Fastify from 'fastify';
import cors from '@fastify/cors';
import pg from 'pg';

const { Pool } = pg;
const port = Number.parseInt(process.env.PORT ?? '3001', 10);
const host = process.env.HOST ?? '0.0.0.0';
const allowedOrigin = process.env.CORS_ORIGIN ?? '*';
const source = process.env.LEADERBOARD_SOURCE ?? 'leaderboard';

// Source is an SQL identifier rather than a query parameter, so validate each
// schema/table segment before quoting it.
const sourceParts = source.split('.');
if (!sourceParts.every((part) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(part))) {
  throw new Error('LEADERBOARD_SOURCE must be a valid table or view identifier.');
}
const quotedSource = sourceParts.map((part) => `"${part}"`).join('.');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: Number.parseInt(process.env.DB_POOL_MAX ?? '10', 10),
  idleTimeoutMillis: 10_000,
  connectionTimeoutMillis: 5_000,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
});

const app = Fastify({ logger: true });

await app.register(cors, { origin: allowedOrigin });

const leaderboardSchema = {
  querystring: {
    type: 'object',
    properties: {
      limit: { type: 'integer', minimum: 1, maximum: 100, default: 50 },
      offset: { type: 'integer', minimum: 0, default: 0 },
    },
    additionalProperties: false,
  },
  response: {
    200: {
      type: 'object',
      required: ['data', 'pagination'],
      properties: {
        data: {
          type: 'array',
          items: {
            type: 'object',
            required: ['rank', 'wallet', 'total_deposited_usd'],
            properties: {
              rank: { type: 'integer' },
              wallet: { type: 'string' },
              // Decimal values are strings so no currency precision is lost in JSON.
              total_deposited_usd: { type: 'string' },
            },
          },
        },
        pagination: {
          type: 'object',
          required: ['limit', 'offset'],
          properties: {
            limit: { type: 'integer' },
            offset: { type: 'integer' },
          },
        },
      },
    },
  },
};

const leaderboardQuery = `
  SELECT
    ROW_NUMBER() OVER (ORDER BY total_deposited_usd::numeric DESC, wallet ASC)::integer AS rank,
    wallet,
    total_deposited_usd::text
  FROM ${quotedSource}
  ORDER BY total_deposited_usd::numeric DESC, wallet ASC
  LIMIT $1 OFFSET $2
`;

async function leaderboardHandler(request) {
  const { limit, offset } = request.query;
  const { rows } = await pool.query(leaderboardQuery, [limit, offset]);

  return {
    data: rows,
    pagination: { limit, offset },
  };
}

app.get('/health', async () => {
  await pool.query('SELECT 1');
  return { status: 'ok' };
});

app.get('/v1/leaderboard', { schema: leaderboardSchema }, leaderboardHandler);
app.get('/leaderboard', { schema: leaderboardSchema }, leaderboardHandler);

app.addHook('onClose', async () => pool.end());

try {
  await app.listen({ port, host });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
