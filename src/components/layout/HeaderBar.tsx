import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  User, Settings, LogOut, ChevronDown, Bell, Users, Shield,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePendingLeaveCount } from '@/hooks/usePendingLeaveCount';
import { useTeamPermissions, UserRole } from '@/hooks/useTeamPermissions';
import { Badge } from '@/components/ui/badge';

const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Administrador',
  rh: 'RH (Leitura)',
  category_chief: 'Chefe de Categoria',
  unit_manager: 'Gerente de Unidade',
  professional: 'Profissional',
};

const ROLE_COLORS: Record<UserRole, string> = {
  admin: 'bg-primary/10 text-primary border-primary/20',
  rh: 'bg-blue-500/10 text-blue-600 border-blue-200',
  category_chief: 'bg-amber-500/10 text-amber-600 border-amber-200',
  unit_manager: 'bg-emerald-500/10 text-emerald-600 border-emerald-200',
  professional: 'bg-muted text-muted-foreground border-border',
};

export function HeaderBar() {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const navigate = useNavigate();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const pendingLeaves = usePendingLeaveCount();
  const { roleInfo, can } = useTeamPermissions();

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          setAdminEmail(user.email || '');
          const { data: profile } = await supabase
            .from('profiles')
            .select('display_name, avatar_url')
            .eq('user_id', user.id)
            .maybeSingle();

          if (profile) {
            setAdminName(profile.display_name || user.user_metadata?.full_name || '');
            setAvatarUrl(profile.avatar_url || null);
          } else {
            setAdminName(user.user_metadata?.full_name || '');
            setAvatarUrl(user.user_metadata?.avatar_url || null);
          }
        }
      } catch (err) {
        console.error('Erro ao carregar perfil:', err);
      }
    };
    loadProfile();

    const channel = supabase
      .channel('header-profile-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
        loadProfile();
      })
      .subscribe();

    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      supabase.removeChannel(channel);
    };
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success('Você saiu do sistema.');
    navigate('/login');
  };

  const adminInitials = adminName
    ? adminName.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
    : adminEmail ? adminEmail[0].toUpperCase() : 'A';

  const userRole = roleInfo?.role || 'admin';

  return (
    <header className="sticky top-0 z-30 flex items-center justify-end h-16 px-4 lg:px-10 bg-transparent no-print pointer-events-none">
      <div className="flex-1" />

      {/* Role badge */}
      <div className="pointer-events-auto mr-3 hidden sm:block">
        <Badge variant="outline" className={cn('text-[10px] font-semibold', ROLE_COLORS[userRole])}>
          <Shield className="w-3 h-3 mr-1" />
          {ROLE_LABELS[userRole]}
        </Badge>
      </div>

      {/* Notification bell */}
      {pendingLeaves > 0 && can('folgas') && (
        <button
          onClick={() => navigate('/escalas-servicos/folgas')}
          className="pointer-events-auto relative mr-3 p-2 rounded-full hover:bg-card/80 transition-colors"
          aria-label={`${pendingLeaves} pedido(s) de folga pendente(s)`}
        >
          <Bell className="w-5 h-5 text-muted-foreground" />
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold px-1 animate-in zoom-in duration-200">
            {pendingLeaves > 9 ? '9+' : pendingLeaves}
          </span>
        </button>
      )}

      <div className="relative pointer-events-auto" ref={dropdownRef}>
        <button
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className={cn(
            "flex items-center gap-2.5 rounded-full pl-1 pr-3 py-1 transition-all duration-200 hover:bg-card/80 active:scale-[0.97] focus:outline-none border",
            dropdownOpen
              ? "bg-card border-border shadow-md"
              : "bg-card/60 border-transparent hover:border-border/50 hover:shadow-sm"
          )}
          aria-label="Menu do perfil"
        >
          <div className="w-9 h-9 rounded-full overflow-hidden shrink-0 ring-2 ring-primary/15">
            {avatarUrl ? (
              <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center">
                <span className="text-xs font-bold text-primary-foreground select-none">{adminInitials}</span>
              </div>
            )}
          </div>

          <div className="hidden sm:flex items-center gap-1">
            <span className="text-sm font-medium text-foreground max-w-[120px] truncate">
              {adminName?.split(' ')[0] || 'Usuário'}
            </span>
            <ChevronDown className={cn(
              "w-3.5 h-3.5 text-muted-foreground transition-transform duration-200",
              dropdownOpen && "rotate-180"
            )} />
          </div>
        </button>

        {/* Dropdown Menu */}
        {dropdownOpen && (
          <div className="absolute right-0 top-full mt-2 w-72 bg-card rounded-2xl shadow-2xl border border-border/50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 z-50">
            {/* Info Section */}
            <div className="p-4 border-b border-border/30 bg-muted/20">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-full overflow-hidden ring-2 ring-primary/15 shrink-0">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center">
                      <span className="text-base font-bold text-primary-foreground">{adminInitials}</span>
                    </div>
                  )}
                </div>
                <div className="flex flex-col min-w-0">
                  <h4 className="font-semibold text-foreground text-sm truncate">{adminName || 'Usuário'}</h4>
                  <p className="text-xs text-muted-foreground truncate">{adminEmail}</p>
                  <Badge variant="outline" className={cn('mt-1 text-[9px] w-fit', ROLE_COLORS[userRole])}>
                    {ROLE_LABELS[userRole]}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Menu Items */}
            <div className="p-1.5 space-y-0.5">
              <button
                onClick={() => { setDropdownOpen(false); navigate('/perfil'); }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-foreground hover:bg-muted/60 transition-colors"
              >
                <User className="w-4 h-4 text-muted-foreground" />
                Meu Perfil
              </button>
              {can('configuracoes') && (
                <button
                  onClick={() => { setDropdownOpen(false); navigate('/configuracoes'); }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-foreground hover:bg-muted/60 transition-colors"
                >
                  <Settings className="w-4 h-4 text-muted-foreground" />
                  Configurações
                </button>
              )}
              {can('gerenciar_membros') && (
                <button
                  onClick={() => { setDropdownOpen(false); navigate('/equipe'); }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-foreground hover:bg-muted/60 transition-colors"
                >
                  <Users className="w-4 h-4 text-muted-foreground" />
                  Gerenciar Equipe
                </button>
              )}
            </div>

            {/* Logout */}
            <div className="border-t border-border/30 p-1.5">
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Sair do Sistema
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
