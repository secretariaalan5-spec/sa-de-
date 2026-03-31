import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuthContext } from '@/contexts/AuthContext';
import {
  LayoutDashboard, Users, CalendarDays, CalendarOff, Building2, Tag, Mail,
  LogOut, Menu, X, Eye, ArrowRightLeft, UserCircle, Wallet,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/untyped-client';
import { useIsMobile } from '@/hooks/use-mobile';
import logoSaude from '@/assets/logo-saude.png';

interface NavItem { to: string; label: string; icon: React.ElementType; roles: string[]; }

const navItems: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin', 'rh', 'category_chief', 'unit_manager', 'professional'] },
  { to: '/funcionarios', label: 'Profissionais', icon: Users, roles: ['admin', 'rh', 'category_chief', 'unit_manager'] },
  { to: '/escalas', label: 'Escalas', icon: CalendarDays, roles: ['admin', 'rh', 'category_chief', 'unit_manager', 'professional'] },
  { to: '/folgas', label: 'Pedidos de Folga', icon: CalendarOff, roles: ['admin', 'rh', 'category_chief', 'unit_manager', 'professional'] },
  { to: '/transferencias', label: 'Transferências', icon: ArrowRightLeft, roles: ['admin', 'rh', 'category_chief'] },
  { to: '/unidades', label: 'Unidades', icon: Building2, roles: ['admin'] },
  { to: '/categorias', label: 'Categorias', icon: Tag, roles: ['admin'] },
  { to: '/saldo', label: 'Saldo de Folgas', icon: Wallet, roles: ['admin', 'rh', 'category_chief', 'unit_manager', 'professional'] },
  { to: '/convites', label: 'Convites', icon: Mail, roles: ['admin'] },
];

export function AppShell() {
  const { roleInfo, signOut, user, isRH } = useAuthContext();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const navigate = useNavigate();

  const role = roleInfo?.role ?? '';
  const filtered = navItems.filter(item => item.roles.includes(role));

  useEffect(() => {
    if (!user) return;
    supabase.from('profiles').select('avatar_url').eq('user_id', user.id).maybeSingle()
      .then(({ data }) => { if (data?.avatar_url) setAvatarUrl(data.avatar_url); });
  }, [user]);

  const handleLogout = async () => { await signOut(); navigate('/login'); };

  const roleLabels: Record<string, string> = {
    admin: 'Administrador', rh: 'RH', category_chief: 'Chefe de Categoria',
    unit_manager: 'Gerente de Unidade', professional: 'Profissional',
  };

  const initials = user?.email?.substring(0, 2).toUpperCase() ?? 'U';

  return (
    <div className="min-h-screen flex w-full">
      <button onClick={() => setMobileOpen(!mobileOpen)} className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-sidebar rounded-lg text-sidebar-foreground no-print shadow-lg">
        {mobileOpen ? <X size={22} /> : <Menu size={22} />}
      </button>

      {mobileOpen && <div className="lg:hidden fixed inset-0 bg-black/50 z-40" onClick={() => setMobileOpen(false)} />}

      <aside className={cn("fixed lg:static inset-y-0 left-0 z-40 w-64 bg-sidebar flex flex-col transition-transform duration-300", mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0")}>
        <div className="p-5 border-b border-sidebar-border">
          <div className="flex items-center gap-3">
            <div className="bg-sidebar-primary/20 p-2 rounded-xl"><Stethoscope size={22} className="text-sidebar-primary" /></div>
            <div>
              <h1 className="text-base font-bold text-sidebar-foreground leading-tight">Saúde+</h1>
              <p className="text-[10px] text-sidebar-foreground/50 uppercase tracking-wider">Gestão de Escalas</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          <p className="text-[10px] uppercase tracking-wider text-sidebar-foreground/40 font-semibold px-3 pt-2 pb-1">Menu</p>
          {filtered.map(item => (
            <NavLink key={item.to} to={item.to} end={item.to === '/'} onClick={() => setMobileOpen(false)}
              className={({ isActive }) => cn("nav-item text-sm", isActive && "active")}>
              <item.icon size={18} />
              <span>{item.label}</span>
              {isRH && <Eye size={12} className="ml-auto opacity-40" />}
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t border-sidebar-border">
          <button
            onClick={() => { navigate('/perfil'); setMobileOpen(false); }}
            className="flex items-center gap-3 px-3 py-2 rounded-lg bg-sidebar-accent/30 mb-2 w-full hover:bg-sidebar-accent/50 transition-colors"
          >
            <Avatar className="h-8 w-8">
              {avatarUrl && <AvatarImage src={avatarUrl} alt="Avatar" />}
              <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground text-xs">{initials}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0 text-left">
              <p className="text-xs font-medium text-sidebar-foreground truncate">{user?.email}</p>
              <p className="text-[10px] text-sidebar-foreground/50">{roleLabels[role]}</p>
            </div>
            <UserCircle size={14} className="text-sidebar-foreground/40" />
          </button>
          <Button variant="ghost" size="sm" onClick={handleLogout}
            className="w-full justify-start gap-2 text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent">
            <LogOut size={15} /> Sair
          </Button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col lg:ml-0 overflow-x-hidden">
        <main className="flex-1 p-4 lg:p-8 pt-16 lg:pt-8"><Outlet /></main>
      </div>
    </div>
  );
}
