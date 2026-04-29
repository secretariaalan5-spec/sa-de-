import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // Aumenta limite de aviso para 600kb (chunks menores aparecerão individualmente)
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // ── Vendor: React core ──────────────────────────────────────────
          if (id.includes("node_modules/react/") ||
              id.includes("node_modules/react-dom/") ||
              id.includes("node_modules/react-router-dom/") ||
              id.includes("node_modules/scheduler/")) {
            return "vendor-react";
          }

          // ── Vendor: Supabase ────────────────────────────────────────────
          if (id.includes("node_modules/@supabase/")) {
            return "vendor-supabase";
          }

          // ── Vendor: Charts (só Dashboard usa) ──────────────────────────
          if (id.includes("node_modules/recharts") ||
              id.includes("node_modules/d3-") ||
              id.includes("node_modules/victory-")) {
            return "vendor-charts";
          }

          // ── Vendor: Radix UI (componentes de UI) ────────────────────────
          if (id.includes("node_modules/@radix-ui/")) {
            return "vendor-radix";
          }

          // ── Vendor: Tanstack (React Query) ──────────────────────────────
          if (id.includes("node_modules/@tanstack/")) {
            return "vendor-query";
          }

          // ── Vendor: framer-motion (animações) ──────────────────────────
          if (id.includes("node_modules/framer-motion")) {
            return "vendor-motion";
          }

          // ── Vendor: PDF + utilidades pesadas ───────────────────────────
          if (id.includes("node_modules/jspdf") ||
              id.includes("node_modules/html2canvas")) {
            return "vendor-pdf";
          }

          // ── Vendor: demais libs de terceiros ───────────────────────────
          if (id.includes("node_modules/")) {
            return "vendor-misc";
          }
        },
      },
    },
  },
}));
