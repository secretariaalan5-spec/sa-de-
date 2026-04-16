import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useSearchParams } from "react-router-dom";
import { AuthProvider, useAuthContext } from "@/contexts/AuthContext";
import { AppShell } from "@/components/layout/AppShell";
import { Loader2 } from "lucide-react";
import Login from "./pages/Login";
import Register from "./pages/Register";
import AcceptInvite from "./pages/AcceptInvite";
import Dashboard from "./pages/Dashboard";
import Employees from "./pages/Employees";
import Schedules from "./pages/Schedules";
import LeaveRequests from "./pages/LeaveRequests";
import Transfers from "./pages/Transfers";
import Units from "./pages/Units";
import Categories from "./pages/Categories";
import Invites from "./pages/Invites";
import Profile from "./pages/Profile";
import BalancePanel from "./pages/BalancePanel";
import AuditLogs from "./pages/AuditLogs";
import Holidays from "./pages/Holidays";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

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
    // If a logged-in user clicks an invite link, save the token before redirecting
    // so it doesn't get stripped out and lost during navigation.
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
            <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
            <Route path="/registro" element={<Register />} />
            <Route path="/registro/:token" element={<Register />} />
            <Route path="/aceite-convite" element={<AcceptInvite />} />
            <Route path="/convite/:token" element={<AcceptInvite />} />

            <Route element={<ProtectedRoute><AppShell /></ProtectedRoute>}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/funcionarios" element={<Employees />} />
              <Route path="/escalas" element={<Schedules />} />
              <Route path="/folgas" element={<LeaveRequests />} />
              <Route path="/transferencias" element={<Transfers />} />
              <Route path="/unidades" element={<Units />} />
              <Route path="/categorias" element={<Categories />} />
              <Route path="/convites" element={<Invites />} />
              <Route path="/perfil" element={<Profile />} />
              <Route path="/saldo" element={<BalancePanel />} />
              <Route path="/auditoria" element={<AuditLogs />} />
              <Route path="/feriados" element={<Holidays />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
