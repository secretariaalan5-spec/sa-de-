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
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        // Estratégia conservadora e segura: apenas separa vendors claramente independentes.
        // Separar react-router-dom de @remix-run/router causava dependência circular.
        manualChunks: (id) => {
          // Supabase é completamente independente — seguro separar
          if (id.includes("node_modules/@supabase/")) {
            return "vendor-supabase";
          }
          // Radix UI é independente — seguro separar
          if (id.includes("node_modules/@radix-ui/")) {
            return "vendor-radix";
          }
          // Recharts é pesado e usado só no Dashboard — seguro separar
          if (id.includes("node_modules/recharts") ||
              id.includes("node_modules/d3-") ||
              id.includes("node_modules/d3 ")) {
            return "vendor-charts";
          }
          // jsPDF — usado só na exportação de escalas
          if (id.includes("node_modules/jspdf")) {
            return "vendor-pdf";
          }
          // NÃO separamos react, react-dom, react-router-dom, @tanstack nem framer-motion
          // pois eles têm inter-dependências internas que o Rollup precisa resolver junto.
        },
      },
    },
  },
}));
