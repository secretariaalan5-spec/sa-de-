import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);

// Register PWA Service Worker (separate from OneSignal's SW)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js', { scope: '/' }).then(registration => {
            console.log('PWA SW registered:', registration.scope);
        }).catch(err => {
            console.log('PWA SW registration failed:', err);
        });
    });
}
