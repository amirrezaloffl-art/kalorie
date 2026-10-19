import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import './styles/index.css';
import './i18n';
import { App } from './app/App';
import { initApp } from './store/app';

registerSW({ immediate: true });

initApp().catch((e) => {
  console.error(e);
  document.getElementById('root')!.textContent = 'Storage error: ' + (e as Error).message;
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
