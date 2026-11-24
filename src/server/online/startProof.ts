import { z } from 'zod';
import { startProofServer } from './proofServer';

const port = z.coerce.number().int().min(1).max(65_535).parse(process.env.PORT ?? 2567);
const server = await startProofServer(port);
console.info(`Prova multiplayer em http://127.0.0.1:${port}`);
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => { void server.gracefullyShutdown(false); });
}
