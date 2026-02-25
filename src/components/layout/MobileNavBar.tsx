import { NavLink } from "@/components/NavLink";
import {
  LayoutDashboard,
  Users,
  Calendar,
  Stethoscope,
  Syringe,
  Settings,
} from "lucide-react";
import { useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";

const items = [
  { to: "/", label: "Início", icon: LayoutDashboard },
  { to: "/profissionais", label: "Profissionais", icon: Users },
  { to: "/escala", label: "Escala", icon: Calendar },
  { to: "/escalas-servicos/enfermeiros", label: "Enf.", icon: Stethoscope },
  { to: "/escalas-servicos/tecnicos", label: "Tec.", icon: Syringe },
  { to: "/configuracoes", label: "Config.", icon: Settings },
] as const;

export function MobileNavBar() {
  const location = useLocation();

  // Esconde barra no portal público
  if (location.pathname.startsWith("/portal")) return null;

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 border-t bg-card/95 backdrop-blur-lg shadow-inner lg:hidden safe-area-bottom">
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

