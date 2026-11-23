import { generateFreeBoard, type FreeBoardRequest } from './FreeEventService';

self.addEventListener('message', (ev: MessageEvent<FreeBoardRequest>) => {
  self.postMessage(generateFreeBoard(ev.data));
});
