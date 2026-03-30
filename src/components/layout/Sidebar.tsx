import { NavLink, useLocation } from 'react-router-dom';
import {
  Users,
  Menu,
  X,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Stethoscope,
  Syringe,
  CalendarOff,
  FileText,
  HeartHandshake,
} from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { usePendingLeaveCount } from '@/hooks/usePendingLeaveCount';
import { useTeamPermissions } from '@/hooks/useTeamPermissions';

const serviceItems = [
  { to: '/escalas-servicos/profissionais', icon: Users, label: 'Profissionais' },
  { to: '/escalas-servicos/enfermeiros', icon: Stethoscope, label: 'Enfermeiros' },
  { to: '/escalas-servicos/tecnicos', icon: Syringe, label: 'Técnicos' },
  { to: '/escalas-servicos/acs', icon: HeartHandshake, label: 'ACS' },
  { to: '/escalas-servicos/folgas', icon: CalendarOff, label: 'Pedidos de Folga' },
  { to: '/escalas-servicos/relatorios', icon: FileText, label: 'Relatórios' },
];

export function Sidebar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isServicosOpen, setIsServicosOpen] = useState(true);
  const location = useLocation();
  const { can } = useTeamPermissions();
  const pendingLeaves = usePendingLeaveCount();

  const filteredServiceItems = serviceItems.filter(item => {
    if (item.to === '/escalas-servicos/profissionais') return can('profissionais');
    if (item.to === '/escalas-servicos/enfermeiros') return can('escalas_servicos');
    if (item.to === '/escalas-servicos/tecnicos') return can('escalas_servicos');
    if (item.to === '/escalas-servicos/acs') return can('escalas_servicos');
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
          {/* Service Group Header */}
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
        </nav>
      </aside>
    </>
  );
}
