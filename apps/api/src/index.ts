/**
 * Shopio API gateway entrypoint.
 *
 * Per `28-developer-platform.md` + `DEC-ARCH-005`.
 * Hosts REST + GraphQL + tRPC endpoints (later) + health checks.
 */

import { buildServer } from './server';
import { getConfig } from './config';

async function main() {
  const config = getConfig();
  const server = await buildServer();
  try {
    await server.listen({ port: config.PORT, host: config.HOST });
    server.log.info(`Shopio API listening on http://${config.HOST}:${config.PORT}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal error during boot:', err);
  process.exit(1);
});
