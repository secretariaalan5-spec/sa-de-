import { NavLink } from "@/components/NavLink";
import {
  LayoutDashboard,
  Calendar,
  Stethoscope,
  Syringe,
  Settings,
  CalendarOff,
} from "lucide-react";
import { useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useTeamPermissions } from "@/hooks/useTeamPermissions";

export function MobileNavBar() {
  const location = useLocation();
  const { can } = useTeamPermissions();

  const items = [
    { to: "/", label: "Início", icon: LayoutDashboard, show: true },
    { to: "/escala", label: "Escala", icon: Calendar, show: can('escalas_emult') },
    { to: "/escalas-servicos/enfermeiros", label: "Enf.", icon: Stethoscope, show: can('escalas_servicos') },
    { to: "/escalas-servicos/tecnicos", label: "Tec.", icon: Syringe, show: can('escalas_servicos') },
    { to: "/escalas-servicos/folgas", label: "Folgas", icon: CalendarOff, show: can('folgas') },
    { to: "/configuracoes", label: "Config.", icon: Settings, show: can('configuracoes') },
  ].filter(i => i.show);

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 border-t bg-card/95 backdrop-blur-lg shadow-inner lg:hidden safe-area-bottom no-print">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-1 py-1">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={cn(
                "flex flex-1 flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1.5 text-[11px] text-muted-foreground transition-colors",
              )}
              activeClassName="text-primary"
            >
              <Icon className="h-5 w-5" />
              <span className="truncate">{item.label}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
