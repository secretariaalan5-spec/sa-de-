import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuthContext } from '@/contexts/AuthContext';
import {
  LayoutDashboard, Users, CalendarDays, CalendarOff, Building2, Tag, Mail,
  LogOut, Menu, X, Eye, ArrowRightLeft, UserCircle, Wallet, Download, ShieldAlert, CalendarHeart, ChevronRight
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
import { GlobalBanner } from '@/components/GlobalBanner';
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
  const swipeDirection = useRef<'none' | 'horizontal' | 'vertical'>('none');

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
  
  // Failsafe: if role isn't loaded yet or mismatched, show at least Dashboard to prevent empty bar
  if (filtered.length === 0) {
    filtered = navItems.filter(item => ['/'].includes(item.to));
  }

  const bottomNavItems = filtered.slice(0, 4);
  const moreNavItems = filtered.slice(4);
  const hasMore = moreNavItems.length > 0;

  if (!layoutReady) return null;

  const handleLogout = async () => {
    await signOut();
    navigate('/login', { replace: true });
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (!isMobile) return;
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    swipeDirection.current = 'none';
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isMobile || swipeDirection.current !== 'none') return;
    
    const deltaX = Math.abs(e.touches[0].clientX - touchStartX.current);
    const deltaY = Math.abs(e.touches[0].clientY - touchStartY.current);
    
    // Determine direction after 10px of movement
    if (deltaX > 10 || deltaY > 10) {
      swipeDirection.current = deltaX > deltaY ? 'horizontal' : 'vertical';
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!isMobile || swipeDirection.current !== 'horizontal') return;
    
    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;
    
    const deltaX = touchStartX.current - touchEndX;
    const deltaY = touchStartY.current - touchEndY;
    
    // Min swipe distance of 60px for a clear intent, and must remain horizontal
    if (Math.abs(deltaX) > 60 && Math.abs(deltaX) > Math.abs(deltaY) * 1.5) {
      if ((e.target as Element).closest('.overflow-x-auto, .schedule-table, .calendar-grid, [role="slider"], .no-swipe')) {
         return; 
      }
      
      const currentIndex = bottomNavItems.findIndex(item => item.to === '/' ? location.pathname === '/' : location.pathname.startsWith(item.to));
      if (currentIndex === -1) return;
      
      if (deltaX > 0 && currentIndex < bottomNavItems.length - 1) {
         navigate(bottomNavItems[currentIndex + 1].to);
      } else if (deltaX < 0 && currentIndex > 0) {
         navigate(bottomNavItems[currentIndex - 1].to);
      }
    }
    swipeDirection.current = 'none';
  };

  const roleLabels: Record<string, string> = {
    admin: 'Administrador', rh: 'RH', category_chief: 'Chefe de Categoria',
    unit_manager: 'Gerente de Unidade', professional: 'Profissional',
  };

  const initials = user?.email?.substring(0, 2).toUpperCase() ?? 'U';

  return (
    <div className="min-h-dvh flex w-full overflow-hidden bg-background">

      {/* ═══ Desktop Sidebar (hidden on mobile) ═══ */}
      {!isMobile && (
        <aside className="static inset-y-0 left-0 z-[70] w-64 bg-sidebar flex-col flex shadow-none">
          <div className="p-5 border-b border-sidebar-border flex items-center justify-between">
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
              <NavLink key={item.to} to={item.to} end={item.to === '/'}
                className={({ isActive }) => cn("nav-item text-sm", isActive && "active")}>
                <item.icon size={18} />
                <span>{item.label}</span>
                {isRH && <Eye size={12} className="ml-auto opacity-40" />}
              </NavLink>
            ))}

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
              onClick={() => navigate('/perfil')}
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
      )}

      {/* ═══ Mobile "Mais" Bottom Sheet ═══ */}
      {isMobile && mobileOpen && (
        <>
          <div className="fixed inset-0 bg-black/50 z-[80] backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <div className="fixed bottom-0 left-0 right-0 z-[90] bg-card rounded-t-3xl shadow-2xl animate-slide-up max-h-[70vh] overflow-y-auto" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 60px)' }}>
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
            </div>
            <div className="px-4 pb-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Mais opções</p>
            </div>
            <nav className="px-3 pb-2 space-y-1">
              {moreNavItems.map(item => (
                <NavLink key={item.to} to={item.to} end={item.to === '/'} onClick={() => setMobileOpen(false)}
                  className={({ isActive }) => cn(
                    "flex items-center gap-4 px-4 py-3 rounded-2xl text-sm font-semibold transition-all native-press",
                    isActive ? "bg-primary/10 text-primary" : "bg-card text-foreground hover:bg-secondary/50"
                  )}>
                  <div className={cn("p-2.5 rounded-xl", isActive ? "bg-primary/20 text-primary" : "bg-secondary text-muted-foreground")}>
                    <item.icon size={20} />
                  </div>
                  <span className="flex-1">{item.label}</span>
                  <ChevronRight size={18} className="text-muted-foreground/40" />
                </NavLink>
              ))}
            </nav>
            <div className="px-4 py-3 border-t border-border">
              <button
                onClick={() => { navigate('/perfil'); setMobileOpen(false); }}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl w-full hover:bg-muted transition-colors"
              >
                <Avatar className="h-8 w-8">
                  {avatarUrl && <AvatarImage src={avatarUrl} alt="Avatar" />}
                  <AvatarFallback className="bg-primary text-primary-foreground text-xs">{initials}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-xs font-medium text-foreground truncate">{user?.email}</p>
                  <p className="text-[10px] text-muted-foreground">{roleDescription || roleLabels[role]}</p>
                </div>
              </button>
              <Button variant="ghost" size="sm" onClick={handleLogout}
                className="w-full justify-start gap-3 text-destructive hover:text-destructive hover:bg-destructive/10 mt-1 rounded-xl py-5">
                <LogOut size={18} /> Sair do Sistema
              </Button>
            </div>
          </div>
        </>
      )}

      {/* ═══ Main Content ═══ */}
      <div className="flex-1 flex flex-col lg:ml-0 overflow-x-hidden">
        {/* Native Mobile Header */}
        {isMobile && (
          <header className="fixed top-0 left-0 right-0 z-50 bg-card/90 backdrop-blur-xl border-b border-border/50 shadow-sm" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
            <div className="h-14 px-4 flex items-center justify-between relative">
              {/* Left: Avatar/Profile */}
              <button onClick={() => navigate('/perfil')} className="p-1 native-press z-10">
                <Avatar className="h-8 w-8 ring-2 ring-primary/10">
                  {avatarUrl && <AvatarImage src={avatarUrl} alt="Avatar" />}
                  <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs">{initials}</AvatarFallback>
                </Avatar>
              </button>

              {/* Center: Title & Subtitle */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="font-bold text-base text-foreground tracking-tight">Saúde+</span>
                {roleDescription && (
                  <span className="text-[9px] font-semibold text-muted-foreground -mt-1 uppercase tracking-wider">{roleDescription}</span>
                )}
              </div>

              {/* Right: Actions */}
              <div className="flex items-center gap-1 z-10">
                {canInstall && (
                  <button onClick={install} className="p-2 text-primary bg-primary/10 hover:bg-primary/20 rounded-full native-press transition-colors">
                    <Download size={18} />
                  </button>
                )}
                <NotificationBell iconClassName="text-muted-foreground hover:text-foreground" />
              </div>
            </div>
          </header>
        )}

        <GlobalBanner />

        <main 
          className={cn(
            "flex-1 overflow-y-auto overflow-x-hidden relative",
            isMobile ? "mobile-main-content" : "p-4 lg:p-8"
          )}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className="animate-fade-in" key={location.pathname}>
            {outlet}
          </div>
        </main>

        {/* ═══ Native Mobile Bottom Tab Bar ═══ */}
        {isMobile && (
          <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card/90 backdrop-blur-xl border-t border-border/50 no-print" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
            <div className="flex items-center justify-around h-[60px] relative px-2">
              {bottomNavItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) => cn(
                    "flex flex-col items-center justify-center flex-1 h-full gap-1 transition-all duration-200 native-press",
                    isActive ? "text-primary" : "text-muted-foreground"
                  )}
                >
                  {({ isActive }) => (
                    <>
                      <div className={cn("transition-all duration-200 flex items-center justify-center", isActive && "bg-primary/10 px-4 py-1 rounded-2xl")}>
                         <item.icon size={22} strokeWidth={isActive ? 2.5 : 2} />
                      </div>
                      <span className={cn("text-[10px]", isActive ? "font-bold" : "font-medium")}>
                        {item.label}
                      </span>
                    </>
                  )}
                </NavLink>
              ))}
              
              {hasMore && (
                <button
                  onClick={() => setMobileOpen(true)}
                  className={cn(
                    "flex flex-col items-center justify-center flex-1 h-full gap-1 transition-all duration-200 native-press",
                    mobileOpen ? "text-primary" : "text-muted-foreground"
                  )}
                >
                  <div className={cn("transition-all duration-200 flex items-center justify-center", mobileOpen && "bg-primary/10 px-4 py-1 rounded-2xl")}>
                     <Menu size={22} strokeWidth={mobileOpen ? 2.5 : 2} />
                  </div>
                  <span className={cn("text-[10px]", mobileOpen ? "font-bold" : "font-medium")}>
                    Mais
                  </span>
                </button>
              )}
            </div>
          </nav>
        )}
      </div>
    </div>
  );
}
