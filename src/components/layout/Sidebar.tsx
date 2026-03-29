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
  Syringe,
  CalendarOff,
  FileText,
} from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { usePendingLeaveCount } from '@/hooks/usePendingLeaveCount';
import { useTeamPermissions } from '@/hooks/useTeamPermissions';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/emult/profissionais', icon: Users, label: 'Profissionais' },
  { to: '/unidades', icon: Building2, label: 'Unidades' },
  { to: '/funcoes', icon: Briefcase, label: 'Funções' },
  { to: '/restricoes', icon: AlertTriangle, label: 'Restrições' },
  { to: '/escala', icon: Calendar, label: 'Escala Base' },
  { to: '/visualizacao', icon: Eye, label: 'Visualização' },
  { to: '/exportar', icon: FileDown, label: 'Exportar' },
];

const serviceItems = [
  { to: '/escalas-servicos/profissionais', icon: Users, label: 'Profissionais' },
  { to: '/escalas-servicos/enfermeiros', icon: Stethoscope, label: 'Enfermeiros' },
  { to: '/escalas-servicos/tecnicos', icon: Syringe, label: 'Técnicos' },
  { to: '/escalas-servicos/folgas', icon: CalendarOff, label: 'Pedidos de Folga' },
  { to: '/escalas-servicos/relatorios', icon: FileText, label: 'Relatórios' },
];

export function Sidebar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isEscalasOpen, setIsEscalasOpen] = useState(false);
  const [isServicosOpen, setIsServicosOpen] = useState(true);
  const location = useLocation();
  const { can } = useTeamPermissions();
  const pendingLeaves = usePendingLeaveCount();

  // Filter nav items based on permissions
  const filteredNavItems = navItems.filter(item => {
    if (item.to === '/emult/profissionais') return can('profissionais');
    if (item.to === '/unidades') return can('unidades');
    if (item.to === '/funcoes') return can('escalas_emult');
    if (item.to === '/restricoes') return can('escalas_emult');
    if (item.to === '/escala') return can('escalas_emult');
    if (item.to === '/visualizacao') return can('escalas_emult');
    if (item.to === '/exportar') return can('escalas_emult');
    return true;
  });

  const filteredServiceItems = serviceItems.filter(item => {
    if (item.to === '/escalas-servicos/profissionais') return can('profissionais');
    if (item.to === '/escalas-servicos/enfermeiros') return can('escalas_servicos');
    if (item.to === '/escalas-servicos/tecnicos') return can('escalas_servicos');
    if (item.to === '/escalas-servicos/folgas') return can('folgas');
    if (item.to === '/escalas-servicos/relatorios') return can('relatorios');
    return true;
  });

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-sidebar rounded-lg text-sidebar-foreground no-print"
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
            className="w-full h-auto max-h-[140px] drop-shadow-md transition-all hover:scale-105"
          />
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {/* Service Group Header - First */}
          {filteredServiceItems.length > 0 && (
            <>
              <button
                onClick={() => setIsServicosOpen(!isServicosOpen)}
                className="w-full flex items-center justify-between p-2 text-sidebar-foreground hover:bg-sidebar-accent rounded-lg transition-colors group"
              >
                <div className="flex items-center gap-2 font-medium">
                  <ClipboardList size={20} />
                  <span>Escalas de Serviços</span>
                </div>
                {isServicosOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </button>

              {isServicosOpen && (
                <div className="pl-4 space-y-1 mt-1">
                  {filteredServiceItems.map((item) => {
                    const showBadge = item.to === '/escalas-servicos/folgas' && pendingLeaves > 0;
                    return (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        onClick={() => setMobileOpen(false)}
                        className={({ isActive }) => cn(
                          "nav-item text-sm relative",
                          isActive && "active"
                        )}
                      >
                        <item.icon size={18} />
                        <span>{item.label}</span>
                        {showBadge && (
                          <span className="ml-auto min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold px-1">
                            {pendingLeaves > 9 ? '9+' : pendingLeaves}
                          </span>
                        )}
                      </NavLink>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {/* eMult Group Header */}
          {filteredNavItems.length > 0 && (
            <>
              <button
                onClick={() => setIsEscalasOpen(!isEscalasOpen)}
                className="w-full flex items-center justify-between p-2 mt-2 text-sidebar-foreground hover:bg-sidebar-accent rounded-lg transition-colors group"
              >
                <div className="flex items-center gap-2 font-medium">
                  <LayoutDashboard size={20} />
                  <span>Escalas eMult</span>
                </div>
                {isEscalasOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </button>

              {isEscalasOpen && (
                <div className="pl-4 space-y-1 mt-1">
                  {filteredNavItems.map((item) => (
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
            </>
          )}
        </nav>
      </aside>
    </>
  );
}
