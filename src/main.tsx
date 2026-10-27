import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);

// Register PWA Service Worker (only in production, not in dev/preview)
if ('serviceWorker' in navigator) {
  if (import.meta.env.PROD) {
    const isInIframe = (() => { try { return window.self !== window.top; } catch { return true; } })();
    const isPreview = window.location.hostname.includes('id-preview--') || window.location.hostname.includes('lovableproject.com');

    if (!isInIframe && !isPreview) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js', { scope: '/' }).then(reg => {
          reg.update().catch(() => {});
        }).catch(() => {});
      });

      navigator.serviceWorker.addEventListener('controllerchange', () => {
        // Se um novo service worker assumiu, atualiza automaticamente em background
      });
    }
  } else {
    navigator.serviceWorker.getRegistrations().then(regs => {
      regs.forEach(r => r.unregister());
    });
    if ('caches' in window) {
      caches.keys().then(names => names.forEach(name => caches.delete(name)));
    }
  }
}
