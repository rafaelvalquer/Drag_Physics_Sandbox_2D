import './ui/styles.css';
import { z } from 'zod';
import { App } from './app/App';

// validation messages shown in the editor follow the UI language
z.config(z.locales.ptBR());

if (new URLSearchParams(location.search).has('artsheet')) {
  // asset-pipeline review tool: contact sheet of the vehicle artwork instead of the game
  void import('./dev/artSheet').then((m) => m.renderArtSheet());
} else {
  const app = new App();
  app.boot().catch((e: unknown) => {
    console.error(e);
    const msg = e instanceof Error ? e.message : String(e);
    document.body.insertAdjacentHTML('beforeend', `<div class="fatal">Falha ao iniciar: ${msg.replace(/</g, '&lt;')}</div>`);
  });

  // Exposed for debugging and the end-to-end tests (read-only inspection of the running app).
  (window as unknown as { __app: App }).__app = app;
}
