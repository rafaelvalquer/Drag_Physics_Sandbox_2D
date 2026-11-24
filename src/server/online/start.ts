import { startOnlineServer } from './server';

try {
  const server = await startOnlineServer(process.env);
  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.once(signal, () => { void server.gracefullyShutdown(false); });
  }
  console.info('Servidor multiplayer pronto.');
} catch (error) {
  console.error('Falha ao iniciar o servidor multiplayer.', error instanceof Error ? error.name : 'unknown');
  process.exitCode = 1;
}
