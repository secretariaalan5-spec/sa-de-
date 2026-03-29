import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Session } from "@supabase/supabase-js";
import { AppLayout } from "@/components/layout/AppLayout";
import Dashboard from "./pages/Dashboard";
import Units from "./pages/Units";
import Functions from "./pages/Functions";
import Restrictions from "./pages/Restrictions";
import Schedule from "./pages/Schedule";
import Visualization from "./pages/Visualization";
import Export from "./pages/Export";
import Settings from "./pages/Settings";
import ProfilePage from "./pages/Profile";
import ServiceScheduleNurses from "./pages/ServiceScheduleNurses";
import ServiceProfessionalsPage from "./pages/ServiceProfessionals";
import ServiceScheduleTechs from "./pages/ServiceScheduleTechs";
import LeaveRequestsPage from "./pages/LeaveRequests";

import ServiceReportsPage from "./pages/ServiceReports";
import Login from "./pages/Login";
import SetPassword from "./pages/SetPassword";
import ProfessionalApprovals from "./pages/ProfessionalApprovals";
import EmultProfessionals from "./pages/EmultProfessionals";
import TeamManagement from "./pages/TeamManagement";
import NotFound from "./pages/NotFound";

import { AppDataProvider } from "./contexts/AppDataContext";
import { ServiceStateProvider } from "./contexts/ServiceStateContext";

const queryClient = new QueryClient();

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsPassword, setNeedsPassword] = useState(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        checkNeedsPassword(session);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        checkNeedsPassword(session);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const checkNeedsPassword = (session: Session) => {
    const passwordStatus = localStorage.getItem('password_set');
    if (passwordStatus === 'true' || passwordStatus === 'skipped') {
      setNeedsPassword(false);
      return;
    }

    // Check if user only has Google provider (no email/password identity)
    const providers = session.user.app_metadata?.providers as string[] | undefined;
    const hasEmailProvider = session.user.identities?.some(
      id => id.provider === 'email'
    );

    // If logged in via Google and never set a password
    const isGoogleOnly = providers?.includes('google') && !hasEmailProvider;
    setNeedsPassword(!!isGoogleOnly);
  };

  if (loading) return null;
  if (!session) return <Navigate to="/login" replace />;
  if (needsPassword) return <Navigate to="/definir-senha" replace />;

  return <>{children}</>;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AppDataProvider>
          <ServiceStateProvider>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/definir-senha" element={<SetPassword />} />

              <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
                <Route path="/" element={<Dashboard />} />
                <Route path="/unidades" element={<Units />} />
                <Route path="/funcoes" element={<Functions />} />
                <Route path="/restricoes" element={<Restrictions />} />
                <Route path="/escala" element={<Schedule />} />
                <Route path="/visualizacao" element={<Visualization />} />
                <Route path="/exportar" element={<Export />} />
                <Route path="/escalas-servicos/enfermeiros" element={<ServiceScheduleNurses />} />
                <Route path="/escalas-servicos/tecnicos" element={<ServiceScheduleTechs />} />
                <Route path="/escalas-servicos/folgas" element={<LeaveRequestsPage />} />

                <Route path="/escalas-servicos/relatorios" element={<ServiceReportsPage />} />
                <Route path="/escalas-servicos/profissionais" element={<ServiceProfessionalsPage />} />
                <Route path="/aprovacoes" element={<ProfessionalApprovals />} />
                <Route path="/emult/profissionais" element={<EmultProfessionals />} />
                <Route path="/configuracoes" element={<Settings />} />
                <Route path="/perfil" element={<ProfilePage />} />
                <Route path="/equipe" element={<TeamManagement />} />
              </Route>

              <Route path="*" element={<NotFound />} />
            </Routes>
          </ServiceStateProvider>
        </AppDataProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
