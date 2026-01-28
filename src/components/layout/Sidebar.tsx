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
  X
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

export function Sidebar() {
  const [mobileOpen, setMobileOpen] = useState(false);
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
        <div className="p-6 border-b border-sidebar-border">
          <h1 className="text-xl font-bold text-sidebar-foreground">
            eMult Escalas
          </h1>
          <p className="text-sm text-sidebar-foreground/60 mt-1">
            Gestão de Equipes
          </p>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) => cn(
                "nav-item",
                isActive && "active"
              )}
            >
              <item.icon size={20} />
              <span>{item.label}</span>
            </NavLink>
          ))}
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
      </aside>
    </>
  );
}
