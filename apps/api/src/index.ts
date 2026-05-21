/**
 * Shopio API gateway.
 *
 * Per `28-developer-platform.md` + `DEC-ARCH-005`.
 * Hosts REST + GraphQL + tRPC endpoints (later) + health checks.
 */

import { buildServer } from './server.js';

const PORT = Number(process.env.PORT ?? 4040);
const HOST = process.env.HOST ?? '0.0.0.0';

async function main() {
  const server = await buildServer();
  try {
    await server.listen({ port: PORT, host: HOST });
    server.log.info(`Shopio API listening on http://${HOST}:${PORT}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal error during boot:', err);
  process.exit(1);
});
