import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Building2,
  Briefcase,
  Calendar,
  Eye,
  AlertTriangle,
  Settings,
  FileDown,
  Menu,
  X,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Stethoscope,
  Syringe
} from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/profissionais', icon: Users, label: 'Profissionais' },
  { to: '/unidades', icon: Building2, label: 'Unidades' },
  { to: '/funcoes', icon: Briefcase, label: 'Funções' },
  { to: '/restricoes', icon: AlertTriangle, label: 'Restrições' },
  { to: '/escala', icon: Calendar, label: 'Escala Base' },
  { to: '/visualizacao', icon: Eye, label: 'Visualização' },
  { to: '/exportar', icon: FileDown, label: 'Exportar' },
];

const serviceItems = [
  { to: '/escalas-servicos/enfermeiros', icon: Stethoscope, label: 'Enfermeiros' },
  { to: '/escalas-servicos/tecnicos', icon: Syringe, label: 'Técnicos' },
];

export function Sidebar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isEscalasOpen, setIsEscalasOpen] = useState(false);
  const [isServicosOpen, setIsServicosOpen] = useState(false);
  const location = useLocation();

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-sidebar rounded-lg text-sidebar-foreground"
      >
        {mobileOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* Overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed lg:static inset-y-0 left-0 z-40 w-64 bg-sidebar flex flex-col transition-transform duration-300",
        mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}>
        <div className="p-6 border-b border-sidebar-border flex justify-center">
          <img
            src="/logo-saude-plus.png"
            alt="Saúde+"
            className="w-full h-auto max-w-[200px] object-contain"
          />
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {/* Group Header */}
          <button
            onClick={() => setIsEscalasOpen(!isEscalasOpen)}
            className="w-full flex items-center justify-between p-2 text-sidebar-foreground hover:bg-sidebar-accent rounded-lg transition-colors group"
          >
            <div className="flex items-center gap-2 font-medium">
              <LayoutDashboard size={20} />
              <span>Escalas eMult</span>
            </div>
            {isEscalasOpen ? (
              <ChevronDown size={16} />
            ) : (
              <ChevronRight size={16} />
            )}
          </button>

          {/* Group Items */}
          {isEscalasOpen && (
            <div className="pl-4 space-y-1 mt-1">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) => cn(
                    "nav-item text-sm",
                    isActive && "active"
                  )}
                >
                  <item.icon size={18} />
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </div>
          )}

          {/* Service Group Header */}
          <button
            onClick={() => setIsServicosOpen(!isServicosOpen)}
            className="w-full flex items-center justify-between p-2 mt-2 text-sidebar-foreground hover:bg-sidebar-accent rounded-lg transition-colors group"
          >
            <div className="flex items-center gap-2 font-medium">
              <ClipboardList size={20} />
              <span>Escalas de Serviços</span>
            </div>
            {isServicosOpen ? (
              <ChevronDown size={16} />
            ) : (
              <ChevronRight size={16} />
            )}
          </button>

          {/* Service Group Items */}
          {isServicosOpen && (
            <div className="pl-4 space-y-1 mt-1">
              {serviceItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) => cn(
                    "nav-item text-sm",
                    isActive && "active"
                  )}
                >
                  <item.icon size={18} />
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </div>
          )}
        </nav>

        <div className="p-4 border-t border-sidebar-border">
          <NavLink
            to="/configuracoes"
            onClick={() => setMobileOpen(false)}
            className={({ isActive }) => cn(
              "nav-item",
              isActive && "active"
            )}
          >
            <Settings size={20} />
            <span>Configurações</span>
          </NavLink>
        </div>
      </aside >
    </>
  );
}
