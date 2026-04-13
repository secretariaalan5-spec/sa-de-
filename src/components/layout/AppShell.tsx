import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuthContext } from '@/contexts/AuthContext';
import {
  LayoutDashboard, Users, CalendarDays, CalendarOff, Building2, Tag, Mail,
  LogOut, Menu, X, Eye, ArrowRightLeft, UserCircle, Wallet, Download, ShieldAlert, CalendarHeart
} from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/untyped-client';
import { useIsMobile } from '@/hooks/use-mobile';
import { useRoleDetails } from '@/hooks/useRoleDetails';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import { NotificationBell } from '@/components/NotificationBell';
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
  { to: '/feriados', label: 'Feriados', icon: CalendarHeart, roles: ['admin'] },
  { to: '/convites', label: 'Convites', icon: Mail, roles: ['admin'] },
  { to: '/auditoria', label: 'Auditoria', icon: ShieldAlert, roles: ['admin'] },
];

export function AppShell() {
  const { roleInfo, signOut, user, isRH } = useAuthContext();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [layoutReady, setLayoutReady] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();
  const outlet = Outlet ? <Outlet /> : null;
  const { roleDescription } = useRoleDetails(roleInfo);
  const { canInstall, install } = usePWAInstall();

  // Gesture refs
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);

  useEffect(() => {
    if (!user) return;
    supabase.from('profiles').select('avatar_url').eq('user_id', user.id).maybeSingle()
      .then(({ data }) => { if (data?.avatar_url) setAvatarUrl(data.avatar_url); });
  }, [user]);

  // Delay rendering until isMobile is determined to prevent sidebar flash
  useEffect(() => {
    if (isMobile !== undefined) setLayoutReady(true);
  }, [isMobile]);

  const role = roleInfo?.role ?? '';
  let filtered = navItems.filter(item => item.roles.includes(role));
  
  // Failsafe: if role isn't loaded yet or mismatched, show at least Dashboard to prevent empty blue bar
  if (filtered.length === 0) {
    filtered = navItems.filter(item => ['/'].includes(item.to));
  }

  const bottomNavItems = filtered.slice(0, 4);
  const hasMore = filtered.length > 4;

  if (!layoutReady) return null;

  const handleLogout = async () => {
    await signOut();
    navigate('/login', { replace: true });
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (!isMobile) return;
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!isMobile) return;
    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;
    
    // Check if swipe was mostly horizontal
    const deltaX = touchStartX.current - touchEndX;
    const deltaY = touchStartY.current - touchEndY;
    
    // Min swipe distance of 50px, mostly horizontal
    if (Math.abs(deltaX) > 60 && Math.abs(deltaX) > Math.abs(deltaY) * 1.5) {
      if ((e.target as Element).closest('.overflow-x-auto, .schedule-table')) {
         return; // Don't swipe if touching a horizontal scroll area (like tables)
      }
      
      const currentIndex = bottomNavItems.findIndex(item => item.to === '/' ? location.pathname === '/' : location.pathname.startsWith(item.to));
      if (currentIndex === -1) return; // Not on a main tab
      
      if (deltaX > 0 && currentIndex < bottomNavItems.length - 1) {
         navigate(bottomNavItems[currentIndex + 1].to);
      } else if (deltaX < 0 && currentIndex > 0) {
         navigate(bottomNavItems[currentIndex - 1].to);
      }
    }
  };

  const roleLabels: Record<string, string> = {
    admin: 'Administrador', rh: 'RH', category_chief: 'Chefe de Categoria',
    unit_manager: 'Gerente de Unidade', professional: 'Profissional',
  };

  const initials = user?.email?.substring(0, 2).toUpperCase() ?? 'U';

  return (
    <div className="h-[100dvh] flex w-full overflow-hidden bg-background">
      {!isMobile && (
        <button onClick={() => setMobileOpen(!mobileOpen)} className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-sidebar rounded-lg text-sidebar-foreground no-print shadow-lg">
          {mobileOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      )}

      {mobileOpen && !isMobile && <div className="lg:hidden fixed inset-0 bg-black/50 z-40" onClick={() => setMobileOpen(false)} />}

      {/* Desktop sidebar */}
      <aside className={cn(
        "fixed lg:static inset-y-0 left-0 z-40 w-64 bg-sidebar flex-col transition-transform duration-300",
        isMobile ? "hidden" : "flex",
        !isMobile && (mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0")
      )}>
        <div className="p-5 border-b border-sidebar-border">
          <div className="flex items-center gap-3">
            <img src={logoSaude} alt="Saúde+" className="w-10 h-10 rounded-xl" />
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

          {/* PWA Install */}
          {canInstall && (
            <>
              <p className="text-[10px] uppercase tracking-wider text-sidebar-foreground/40 font-semibold px-3 pt-4 pb-1">App</p>
              <button onClick={install}
                className="nav-item text-sm w-full text-left flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-sidebar-accent text-sidebar-foreground/70 hover:text-sidebar-foreground transition-colors">
                <Download size={18} />
                <span>Instalar App</span>
              </button>
            </>
          )}
        </nav>

        <div className="p-3 border-t border-sidebar-border">
          <div className="flex items-center justify-between mb-2 px-1">
            <span className="text-xs font-semibold text-sidebar-foreground/50 uppercase tracking-wider">Alertas</span>
            <NotificationBell iconClassName="text-sidebar-foreground/70 hover:text-sidebar-foreground" />
          </div>
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
              <p className="text-[10px] text-sidebar-foreground/50">{roleDescription || roleLabels[role]}</p>
            </div>
            <UserCircle size={14} className="text-sidebar-foreground/40" />
          </button>
          <Button variant="ghost" size="sm" onClick={handleLogout}
            className="w-full justify-start gap-2 text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent">
            <LogOut size={15} /> Sair
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col lg:ml-0 overflow-x-hidden">
        {/* Mobile top header */}
        {isMobile && (
          <header className="fixed top-0 left-0 right-0 z-50 bg-primary shadow-md" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
            <div className="px-4 py-2.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <img src={logoSaude} alt="Saúde+" className="w-8 h-8 rounded-lg" />
                <div>
                  <span className="text-primary-foreground font-bold text-sm">Saúde+</span>
                  {roleDescription && (
                    <p className="text-primary-foreground/70 text-[9px] leading-tight truncate max-w-[180px]">{roleDescription}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <NotificationBell iconClassName="text-primary-foreground/70 hover:text-primary-foreground" />
                {canInstall && (
                  <button onClick={install} className="p-1.5 text-primary-foreground/70 hover:text-primary-foreground native-press">
                    <Download size={18} />
                  </button>
                )}
                <button onClick={() => navigate('/perfil')} className="p-1 native-press">
                  <Avatar className="h-7 w-7">
                    {avatarUrl && <AvatarImage src={avatarUrl} alt="Avatar" />}
                    <AvatarFallback className="bg-primary-foreground/20 text-primary-foreground text-[10px]">{initials}</AvatarFallback>
                  </Avatar>
                </button>
                <button onClick={handleLogout} className="p-1.5 text-primary-foreground/70 hover:text-primary-foreground native-press">
                  <LogOut size={18} />
                </button>
              </div>
            </div>
          </header>
        )}

        <main 
          className={cn(
            "flex-1 overflow-y-auto overflow-x-hidden relative",
            isMobile ? "p-4 mobile-main-content" : "p-4 lg:p-8"
          )}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <div className="animate-fade-in" key={location.pathname}>
            {outlet}
          </div>
        </main>

        {/* Mobile bottom navigation */}
        {isMobile && (
          <nav className="fixed bottom-0 left-0 right-0 z-50 bg-primary/95 backdrop-blur-md shadow-[0_-4px_20px_rgba(0,0,0,0.15)]" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
          <div className="flex items-stretch justify-around px-2 py-1.5">
            {bottomNavItems.map(item => {
              const isActive = item.to === '/' ? location.pathname === '/' : location.pathname.startsWith(item.to);
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  className="flex flex-col items-center justify-center py-1.5 px-1 flex-1 min-w-0 native-press"
                >
                  <div className={cn(
                    "relative flex items-center justify-center w-12 h-7 rounded-2xl transition-all duration-300",
                    isActive ? "bg-white/20 scale-105" : "bg-transparent"
                  )}>
                    <item.icon size={20} className={cn(
                      "transition-all duration-200",
                      isActive ? "text-white" : "text-blue-100/70"
                    )} />
                  </div>
                  <span className={cn(
                    "text-[10px] mt-0.5 truncate max-w-full transition-all duration-200",
                    isActive ? "text-white font-semibold" : "text-blue-100/70"
                  )}>
                    {item.label}
                  </span>
                </NavLink>
              );
            })}
            {hasMore && (
              <button
                onClick={() => setMobileOpen(!mobileOpen)}
                className="flex flex-col items-center justify-center py-1.5 px-1 flex-1 min-w-0 native-press"
              >
                <div className={cn(
                    "relative flex items-center justify-center w-12 h-7 rounded-2xl transition-all duration-300",
                    mobileOpen ? "bg-white/20 scale-105" : "bg-transparent"
                  )}>
                  {mobileOpen ? (
                    <X size={20} className="text-white transition-all duration-200" />
                  ) : (
                    <Menu size={20} className="text-blue-100/70 transition-all duration-200" />
                  )}
                </div>
                <span className={cn(
                  "text-[10px] mt-0.5 transition-all duration-200",
                  mobileOpen ? "text-white font-semibold" : "text-blue-100/70"
                )}>Mais</span>
              </button>
            )}
          </div>
        </nav>
        )}

      </div>

      {/* Mobile "More" drawer */}
      {isMobile && mobileOpen && (
        <>
          <div className="fixed inset-0 bg-black/50 z-[60] backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <div className="fixed bottom-0 left-0 right-0 z-[60] bg-card rounded-t-3xl shadow-2xl max-h-[65vh] overflow-y-auto animate-slide-up" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)' }}>
            <div className="p-3 flex justify-center">
              <div className="w-10 h-1.5 bg-muted-foreground/25 rounded-full" />
            </div>
            <div className="px-4 pb-2 space-y-0.5">
              {filtered.slice(4).map(item => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) => cn(
                    "flex items-center gap-3 px-4 py-3.5 rounded-2xl text-sm transition-all native-press",
                    isActive ? "bg-primary/10 text-primary font-semibold" : "text-foreground hover:bg-muted/60"
                  )}
                >
                  <item.icon size={20} />
                  <span>{item.label}</span>
                </NavLink>
              ))}
              {canInstall && (
                <button
                  onClick={() => { install(); setMobileOpen(false); }}
                  className="flex items-center gap-3 px-4 py-3.5 rounded-2xl text-sm transition-all text-foreground hover:bg-muted/60 w-full native-press"
                >
                  <Download size={20} />
                  <span>Instalar App</span>
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
