import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useSearchParams } from "react-router-dom";
import { AuthProvider, useAuthContext } from "@/contexts/AuthContext";
import { AppShell } from "@/components/layout/AppShell";
import { Loader2 } from "lucide-react";
import { lazy, Suspense } from "react";
import Login from "./pages/Login";
import Register from "./pages/Register";
import AcceptInvite from "./pages/AcceptInvite";

// ─── Lazy-loaded pages (cada uma vira um chunk separado) ─────────────────────
// O usuário baixa apenas o que precisa ver, não tudo de uma vez.
const Dashboard      = lazy(() => import("./pages/Dashboard"));
const Employees      = lazy(() => import("./pages/Employees"));
const Schedules      = lazy(() => import("./pages/Schedules"));
const LeaveRequests  = lazy(() => import("./pages/LeaveRequests"));
const Transfers      = lazy(() => import("./pages/Transfers"));
const Units          = lazy(() => import("./pages/Units"));
const Categories     = lazy(() => import("./pages/Categories"));
const Invites        = lazy(() => import("./pages/Invites"));
const Profile        = lazy(() => import("./pages/Profile"));
const BalancePanel   = lazy(() => import("./pages/BalancePanel"));
const AuditLogs      = lazy(() => import("./pages/AuditLogs"));
const Holidays       = lazy(() => import("./pages/Holidays"));
const NotFound       = lazy(() => import("./pages/NotFound"));

// ─── QueryClient com estratégia de cache inteligente ─────────────────────────
// staleTime: 5 min  → dados não re-buscados se a tela for reaberta em 5min
// gcTime:    30 min → dados ficam em memória por 30min (navegar entre abas = instantâneo)
// retry: 1          → tenta 1x antes de mostrar erro (não trava em offline)
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000,   // 5 minutos
      gcTime:    30 * 60 * 1000,  // 30 minutos
    },
  },
});

// ─── Loading spinner leve para o Suspense ─────────────────────────────────────
function PageLoader() {
  return (
    <div className="flex-1 flex items-center justify-center min-h-[200px]">
      <Loader2 className="w-6 h-6 animate-spin text-primary opacity-60" />
    </div>
  );
}

function AuthLoadingScreen() {
  return (
    <div className="h-screen w-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Verificando acesso...</p>
      </div>
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuthContext();
  if (loading) return <AuthLoadingScreen />;
  if (!session) return <Navigate to="/login" replace />;
  return <>{children}</>;  
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuthContext();
  const [searchParams] = useSearchParams();
  
  if (loading) return null;
  
  if (session) {
    const token = searchParams.get('token');
    if (token) {
      localStorage.setItem('pending_invite_token', token);
    }
    return <Navigate to="/" replace />;
  }
  
  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login"              element={<PublicRoute><Login /></PublicRoute>} />
            <Route path="/registro"           element={<Register />} />
            <Route path="/registro/:token"    element={<Register />} />
            <Route path="/aceite-convite"     element={<AcceptInvite />} />
            <Route path="/convite/:token"     element={<AcceptInvite />} />

            <Route element={<ProtectedRoute><AppShell /></ProtectedRoute>}>
              {/* Cada página é baixada só quando o usuário navegar para ela */}
              <Route path="/"             element={<Suspense fallback={<PageLoader />}><Dashboard /></Suspense>} />
              <Route path="/funcionarios" element={<Suspense fallback={<PageLoader />}><Employees /></Suspense>} />
              <Route path="/escalas"      element={<Suspense fallback={<PageLoader />}><Schedules /></Suspense>} />
              <Route path="/folgas"       element={<Suspense fallback={<PageLoader />}><LeaveRequests /></Suspense>} />
              <Route path="/transferencias" element={<Suspense fallback={<PageLoader />}><Transfers /></Suspense>} />
              <Route path="/unidades"     element={<Suspense fallback={<PageLoader />}><Units /></Suspense>} />
              <Route path="/categorias"   element={<Suspense fallback={<PageLoader />}><Categories /></Suspense>} />
              <Route path="/convites"     element={<Suspense fallback={<PageLoader />}><Invites /></Suspense>} />
              <Route path="/perfil"       element={<Suspense fallback={<PageLoader />}><Profile /></Suspense>} />
              <Route path="/saldo"        element={<Suspense fallback={<PageLoader />}><BalancePanel /></Suspense>} />
              <Route path="/auditoria"    element={<Suspense fallback={<PageLoader />}><AuditLogs /></Suspense>} />
              <Route path="/feriados"     element={<Suspense fallback={<PageLoader />}><Holidays /></Suspense>} />
            </Route>

            <Route path="*" element={<Suspense fallback={<PageLoader />}><NotFound /></Suspense>} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
