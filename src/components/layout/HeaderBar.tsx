import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
    User, Settings, LogOut, UserPlus,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export function HeaderBar() {
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [adminName, setAdminName] = useState('');
    const [adminEmail, setAdminEmail] = useState('');
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
    const navigate = useNavigate();
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const loadProfile = async () => {
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    setAdminName(user.user_metadata?.full_name || '');
                    setAdminEmail(user.email || '');
                    setAvatarUrl(user.user_metadata?.avatar_url || null);
                }
            } catch (err) {
                console.error('Erro ao carregar perfil:', err);
            }
        };
        loadProfile();

        // Clique fora para fechar o dropdown
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleLogout = async () => {
        await supabase.auth.signOut();
        toast.success('Você saiu do sistema.');
        navigate('/login');
    };

    const adminInitials = adminName
        ? adminName.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
        : adminEmail ? adminEmail[0].toUpperCase() : 'A';

    return (
        <header className="sticky top-0 z-30 flex items-center justify-end h-16 px-4 lg:px-10 bg-transparent no-print pointer-events-none">
            {/* O cabeçalho é transparente para não interferir visualmente no corpo da página */}
            <div className="flex-1" />

            {/* Avatar / Botão de Perfil Redondo no Canto Superior Direito */}
            <div className="relative translate-y-4 pointer-events-auto" ref={dropdownRef}>
                <button
                    onClick={() => setDropdownOpen(!dropdownOpen)}
                    className={cn(
                        "relative w-11 h-11 rounded-full overflow-hidden border-2 transition-all duration-300 hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:ring-offset-2 shadow-lg",
                        dropdownOpen
                            ? "border-primary"
                            : "border-white/80 hover:border-primary/50"
                    )}
                    aria-label="Menu do perfil"
                >
                    {avatarUrl ? (
                        <img
                            src={avatarUrl}
                            alt="Avatar"
                            className="w-full h-full object-cover"
                        />
                    ) : (
                        <div className="w-full h-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
                            <span className="text-sm font-bold text-white select-none">{adminInitials}</span>
                        </div>
                    )}

                    {/* Indicador de Status */}
                    <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full border-2 border-background" />
                </button>

                {/* Dropdown Menu */}
                {dropdownOpen && (
                    <div className="absolute right-0 top-full mt-2 w-72 bg-card rounded-2xl shadow-2xl border border-border/50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 z-50">
                        {/* Info Section */}
                        <div className="p-5 border-b border-border/30 bg-muted/20">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-primary/20 shrink-0">
                                    {avatarUrl ? (
                                        <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full bg-primary/10 flex items-center justify-center">
                                            <span className="text-lg font-bold text-primary">{adminInitials}</span>
                                        </div>
                                    )}
                                </div>
                                <div className="flex flex-col min-w-0">
                                    <h4 className="font-bold text-foreground text-sm truncate">{adminName || 'Administrador'}</h4>
                                    <p className="text-xs text-muted-foreground truncate">{adminEmail}</p>
                                </div>
                            </div>
                        </div>

                        {/* Menu Items */}
                        <div className="p-2 space-y-1">
                            <button
                                onClick={() => { setDropdownOpen(false); navigate('/perfil'); }}
                                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-foreground hover:bg-muted/60 transition-colors"
                            >
                                <User className="w-4 h-4 text-muted-foreground" />
                                Meu Perfil
                            </button>
                            <button
                                onClick={() => { setDropdownOpen(false); navigate('/configuracoes'); }}
                                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-foreground hover:bg-muted/60 transition-colors"
                            >
                                <Settings className="w-4 h-4 text-muted-foreground" />
                                Configurações
                            </button>
                        </div>

                        {/* Logout Section */}
                        <div className="border-t border-border/30 p-2">
                            <button
                                onClick={handleLogout}
                                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
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
