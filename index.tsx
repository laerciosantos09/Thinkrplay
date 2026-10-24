
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { registerSW } from 'virtual:pwa-register';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// App instalado/PWA: busca versão nova ao abrir e de hora em hora, e recarrega quando ela assume o controle
// (sem isso, depois de um deploy o aparelho pode ficar com a tela antiga até fechar e abrir o app duas vezes).
registerSW({
  immediate: true,
  onRegisteredSW: (_url, registration) => {
    if (registration) setInterval(() => registration.update().catch(() => {}), 60 * 60 * 1000);
  },
});
