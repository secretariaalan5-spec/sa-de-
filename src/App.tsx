import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useSearchParams } from "react-router-dom";
import { AuthProvider, useAuthContext } from "@/contexts/AuthContext";
import { AppShell } from "@/components/layout/AppShell";
import { Loader2, WifiOff, RefreshCw } from "lucide-react";
import { lazy, Suspense, Component, ErrorInfo, ReactNode } from "react";
import Login from "./pages/Login";
import Register from "./pages/Register";
import AcceptInvite from "./pages/AcceptInvite";

// ─── Lazy-loaded pages ────────────────────────────────────────────────────────
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

// ─── QueryClient com cache inteligente ────────────────────────────────────────
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000,   // 5 min: não re-busca se dados ainda são frescos
      gcTime:    30 * 60 * 1000,  // 30 min: mantém dados em memória (trocar de aba = instantâneo)
    },
  },
});

// ─── ErrorBoundary ────────────────────────────────────────────────────────────
// Captura erros de lazy loading e erros inesperados de componentes.
// Sem ele, um erro silencioso desmontaria a árvore inteira e exibiria a tela azul do body.
interface ErrorBoundaryState { hasError: boolean; isChunkError: boolean; }
class AppErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, isChunkError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    // Detecta erros de carregamento de chunk (rede lenta ou offline)
    const isChunkError =
      error.message?.includes('Failed to fetch dynamically imported module') ||
      error.message?.includes('Importing a module script failed') ||
      error.message?.includes('Loading chunk') ||
      error.name === 'ChunkLoadError';
    return { hasError: true, isChunkError };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[AppErrorBoundary]', error, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="h-screen w-screen flex items-center justify-center bg-background p-6">
        <div className="flex flex-col items-center gap-4 max-w-sm text-center">
          {this.state.isChunkError ? (
            <>
              <div className="w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center">
                <WifiOff className="w-8 h-8 text-amber-500" />
              </div>
              <h1 className="text-xl font-bold text-foreground">Sem conexão</h1>
              <p className="text-sm text-muted-foreground">
                Não foi possível carregar o sistema. Verifique sua internet e tente novamente.
              </p>
            </>
          ) : (
            <>
              <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
                <RefreshCw className="w-8 h-8 text-destructive" />
              </div>
              <h1 className="text-xl font-bold text-foreground">Algo deu errado</h1>
              <p className="text-sm text-muted-foreground">
                Ocorreu um erro inesperado. Tente recarregar a página.
              </p>
            </>
          )}
          <button
            onClick={() => window.location.reload()}
            className="mt-2 px-6 py-3 bg-primary text-primary-foreground rounded-full font-semibold text-sm hover:bg-primary/90 transition-colors"
          >
            Recarregar
          </button>
        </div>
      </div>
    );
  }
}

// ─── Loaders ──────────────────────────────────────────────────────────────────
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

// ─── Route Guards ─────────────────────────────────────────────────────────────
function ProtectedRoute({ children }: { children: ReactNode }) {
  const { session, loading } = useAuthContext();
  if (loading) return <AuthLoadingScreen />;
  if (!session) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function PublicRoute({ children }: { children: ReactNode }) {
  const { session, loading } = useAuthContext();
  const [searchParams] = useSearchParams();

  if (loading) return null;

  if (session) {
    const token = searchParams.get('token');
    if (token) localStorage.setItem('pending_invite_token', token);
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

// ─── App ──────────────────────────────────────────────────────────────────────
const App = () => (
  <AppErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/login"             element={<PublicRoute><Login /></PublicRoute>} />
              <Route path="/registro"          element={<Register />} />
              <Route path="/registro/:token"   element={<Register />} />
              <Route path="/aceite-convite"    element={<AcceptInvite />} />
              <Route path="/convite/:token"    element={<AcceptInvite />} />

              <Route element={<ProtectedRoute><AppShell /></ProtectedRoute>}>
                <Route path="/"              element={<AppErrorBoundary><Suspense fallback={<PageLoader />}><Dashboard /></Suspense></AppErrorBoundary>} />
                <Route path="/funcionarios"  element={<AppErrorBoundary><Suspense fallback={<PageLoader />}><Employees /></Suspense></AppErrorBoundary>} />
                <Route path="/escalas"       element={<AppErrorBoundary><Suspense fallback={<PageLoader />}><Schedules /></Suspense></AppErrorBoundary>} />
                <Route path="/folgas"        element={<AppErrorBoundary><Suspense fallback={<PageLoader />}><LeaveRequests /></Suspense></AppErrorBoundary>} />
                <Route path="/transferencias" element={<AppErrorBoundary><Suspense fallback={<PageLoader />}><Transfers /></Suspense></AppErrorBoundary>} />
                <Route path="/unidades"      element={<AppErrorBoundary><Suspense fallback={<PageLoader />}><Units /></Suspense></AppErrorBoundary>} />
                <Route path="/categorias"    element={<AppErrorBoundary><Suspense fallback={<PageLoader />}><Categories /></Suspense></AppErrorBoundary>} />
                <Route path="/convites"      element={<AppErrorBoundary><Suspense fallback={<PageLoader />}><Invites /></Suspense></AppErrorBoundary>} />
                <Route path="/perfil"        element={<AppErrorBoundary><Suspense fallback={<PageLoader />}><Profile /></Suspense></AppErrorBoundary>} />
                <Route path="/saldo"         element={<AppErrorBoundary><Suspense fallback={<PageLoader />}><BalancePanel /></Suspense></AppErrorBoundary>} />
                <Route path="/auditoria"     element={<AppErrorBoundary><Suspense fallback={<PageLoader />}><AuditLogs /></Suspense></AppErrorBoundary>} />
                <Route path="/feriados"      element={<AppErrorBoundary><Suspense fallback={<PageLoader />}><Holidays /></Suspense></AppErrorBoundary>} />
              </Route>

              <Route path="*" element={<AppErrorBoundary><Suspense fallback={<PageLoader />}><NotFound /></Suspense></AppErrorBoundary>} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </AppErrorBoundary>
);

export default App;
