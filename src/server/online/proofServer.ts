import { Server } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { PROOF_ROOM, ProofRaceRoom } from './ProofRaceRoom';

export async function startProofServer(port: number) {
  const transport = new WebSocketTransport({ maxPayload: 8_192 });
  const server = new Server({ transport, greet: false, gracefullyShutdown: false });
  transport.getExpressApp().get('/health', (_request, response) => response.json({ status: 'ok', mode: 'proof' }));
  server.define(PROOF_ROOM, ProofRaceRoom);
  await server.listen(port, '127.0.0.1');
  return server;
}
