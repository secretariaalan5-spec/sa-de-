import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuthContext } from "@/contexts/AuthContext";
import { AppShell } from "@/components/layout/AppShell";
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
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuthContext();
  if (loading) return null;
  if (!session) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function RootRedirect() {
  const { session, loading } = useAuthContext();
  if (loading) return null;
  return <Navigate to={session ? "/" : "/login"} replace />;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuthContext();
  if (loading) return null;
  if (session) return <Navigate to="/" replace />;
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
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
