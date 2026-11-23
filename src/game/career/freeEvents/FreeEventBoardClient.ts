import { generateFreeBoard, type FreeBoardRequest, type FreeBoardResponse } from './FreeEventService';

/** Browser offer generation runs away from the render loop. Node tests use the same generator. */
export async function requestFreeBoard(request: FreeBoardRequest): Promise<FreeBoardResponse> {
  if (typeof Worker === 'undefined') return generateFreeBoard(structuredClone(request));
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./FreeEventWorker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (ev: MessageEvent<FreeBoardResponse>) => {
      worker.terminate();
      resolve(ev.data);
    };
    worker.onerror = (ev) => {
      worker.terminate();
      reject(new Error(ev.message || 'Falha ao gerar adversários.'));
    };
    worker.postMessage(request);
  });
}
