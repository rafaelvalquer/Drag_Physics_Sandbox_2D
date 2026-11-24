import { z } from 'zod';
import { startOnlineServer } from './server';

try {
  const server = await startOnlineServer(process.env);
  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.once(signal, () => { void server.gracefullyShutdown(false); });
  }
  console.info('Servidor multiplayer pronto.');
} catch (error) {
  if (error instanceof z.ZodError) {
    const fields = error.issues.map(({ path, code }) => `${path.map(String).join('.')} (${code})`);
    console.error('Configuração inválida do servidor multiplayer.', fields.join(', '));
  } else {
    const code = error instanceof Error && 'code' in error && typeof error.code === 'string' && /^[A-Z0-9_]{2,24}$/.test(error.code)
      ? error.code
      : undefined;
    console.error('Falha ao iniciar o servidor multiplayer.', error instanceof Error ? error.name : 'unknown', code ?? '');
  }
  process.exitCode = 1;
}
