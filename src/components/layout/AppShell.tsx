import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuthContext } from '@/contexts/AuthContext';
import {
  LayoutDashboard,
  Users,
  CalendarDays,
  CalendarOff,
  Building2,
  Tag,
  Mail,
  LogOut,
  Menu,
  X,
  Eye,
  ArrowRightLeft,
} from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface NavItem {
  to: string;
  label: string;
  icon: React.ElementType;
  roles: string[];
}

const navItems: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin', 'rh', 'category_chief', 'unit_manager'] },
  { to: '/funcionarios', label: 'Funcionários', icon: Users, roles: ['admin', 'rh', 'category_chief', 'unit_manager'] },
  { to: '/escalas', label: 'Escalas', icon: CalendarDays, roles: ['admin', 'rh', 'category_chief', 'unit_manager'] },
  { to: '/folgas', label: 'Pedidos de Folga', icon: CalendarOff, roles: ['admin', 'rh', 'category_chief', 'unit_manager'] },
  { to: '/transferencias', label: 'Transferências', icon: ArrowRightLeft, roles: ['admin', 'rh', 'category_chief'] },
  { to: '/unidades', label: 'Unidades', icon: Building2, roles: ['admin'] },
  { to: '/categorias', label: 'Categorias', icon: Tag, roles: ['admin'] },
  { to: '/convites', label: 'Convites', icon: Mail, roles: ['admin'] },
];

export function AppShell() {
  const { roleInfo, signOut, user, isRH } = useAuthContext();
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();

  const role = roleInfo?.role ?? 'admin';
  const filtered = navItems.filter(item => item.roles.includes(role));

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  const roleLabels: Record<string, string> = {
    admin: 'Administrador',
    rh: 'RH (Leitura)',
    category_chief: 'Chefe de Categoria',
    unit_manager: 'Gerente de Unidade',
    professional: 'Profissional',
  };

  return (
    <div className="min-h-screen flex w-full">
      {/* Mobile toggle */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-sidebar rounded-lg text-sidebar-foreground no-print"
      >
        {mobileOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* Overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 bg-black/50 z-40" onClick={() => setMobileOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed lg:static inset-y-0 left-0 z-40 w-64 bg-sidebar flex flex-col transition-transform duration-300",
        mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}>
        <div className="p-6 border-b border-sidebar-border text-center">
          <h1 className="text-xl font-bold text-sidebar-foreground">Saúde+ Escalas</h1>
          <p className="text-xs text-sidebar-foreground/60 mt-1">{roleLabels[role]}</p>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {filtered.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) => cn("nav-item text-sm", isActive && "active")}
            >
              <item.icon size={18} />
              <span>{item.label}</span>
              {isRH && (
                <Eye size={14} className="ml-auto opacity-50" />
              )}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-sidebar-border">
          <p className="text-xs text-sidebar-foreground/60 truncate mb-2">{user?.email}</p>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="w-full justify-start gap-2 text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent"
          >
            <LogOut size={16} />
            Sair
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col lg:ml-0 overflow-x-hidden">
        <main className="flex-1 p-4 lg:p-8 pt-16 lg:pt-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
