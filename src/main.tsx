import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);

// Register PWA Service Worker (ativo em produção e desenvolvimento para push notifications)
if ('serviceWorker' in navigator) {
  const isInIframe = (() => { try { return window.self !== window.top; } catch { return true; } })();
  const isPreview = window.location.hostname.includes('id-preview--') || window.location.hostname.includes('lovableproject.com');

  if (!isInIframe && !isPreview) {
    const registerSW = () => {
      navigator.serviceWorker.register('/sw.js', { scope: '/' })
        .then(reg => {
          reg.update().catch(() => {});
        })
        .catch(err => {
          console.warn('[SW] Registration failed:', err);
        });
    };

    if (document.readyState === 'complete') {
      registerSW();
    } else {
      window.addEventListener('load', registerSW);
    }

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      // Novo service worker assumiu
    });
  }
}
