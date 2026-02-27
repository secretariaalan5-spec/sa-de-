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
import Professionals from "./pages/Professionals";
import Units from "./pages/Units";
import Functions from "./pages/Functions";
import Restrictions from "./pages/Restrictions";
import Schedule from "./pages/Schedule";
import Visualization from "./pages/Visualization";
import Export from "./pages/Export";
import Settings from "./pages/Settings";
import ServiceScheduleNurses from "./pages/ServiceScheduleNurses";
import ServiceScheduleTechs from "./pages/ServiceScheduleTechs";
import ServiceProfessionalsPage from "./pages/ServiceProfessionals";
import LeaveRequestsPage from "./pages/LeaveRequests";
import IndividualControlPage from "./pages/IndividualControl";
import ServiceReportsPage from "./pages/ServiceReports";
import Portal from "./pages/Portal";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";

import { AppDataProvider } from "./contexts/AppDataContext";
import { ServiceStateProvider } from "./contexts/ServiceStateContext";

const queryClient = new QueryClient();

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) return null;
  if (!session) return <Navigate to="/login" replace />;

  return <>{children}</>;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AppDataProvider>
        <ServiceStateProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<Login />} />

              <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
                <Route path="/" element={<Dashboard />} />
                <Route path="/profissionais" element={<Professionals />} />
                <Route path="/unidades" element={<Units />} />
                <Route path="/funcoes" element={<Functions />} />
                <Route path="/restricoes" element={<Restrictions />} />
                <Route path="/escala" element={<Schedule />} />
                <Route path="/visualizacao" element={<Visualization />} />
                <Route path="/exportar" element={<Export />} />
                <Route path="/escalas-servicos/enfermeiros" element={<ServiceScheduleNurses />} />
                <Route path="/escalas-servicos/tecnicos" element={<ServiceScheduleTechs />} />
                <Route path="/escalas-servicos/profissionais" element={<ServiceProfessionalsPage />} />
                <Route path="/escalas-servicos/folgas" element={<LeaveRequestsPage />} />
                <Route path="/escalas-servicos/controle" element={<IndividualControlPage />} />
                <Route path="/escalas-servicos/relatorios" element={<ServiceReportsPage />} />
                <Route path="/configuracoes" element={<Settings />} />
              </Route>

              <Route path="/portal" element={<Portal />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </ServiceStateProvider>
      </AppDataProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
