import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/untyped-client';
import { toast } from 'sonner';

// ── Tipos ──────────────────────────────────────────────────────────────────

export type InviteAccessLevel = 'emult' | 'nurse' | 'tech';

export interface PortalInvite {
    id: string;
    admin_id: string;
    code: string;
    access_level: InviteAccessLevel;
    label: string;
    is_active: boolean;
    uses_count: number;
    max_uses: number | null;
    expires_at: string | null;
    created_at: string;
}

// ── Gerador de código de convite ────────────────────────────────────────────

const LEVEL_PREFIX: Record<InviteAccessLevel, string> = {
    emult: 'EMT',
    nurse: 'ENF',
    tech: 'TEC',
};

export function generateInviteCode(level: InviteAccessLevel): string {
    const prefix = LEVEL_PREFIX[level];
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sem ambíguos (0/O, 1/I)
    let suffix = '';
    for (let i = 0; i < 6; i++) {
        suffix += chars[Math.floor(Math.random() * chars.length)];
    }
    return `${prefix}-${suffix}`;
}

// ── Hook ────────────────────────────────────────────────────────────────────

export function usePortalInvites(userId: string | null) {
    const [invites, setInvites] = useState<PortalInvite[]>([]);
    const [loading, setLoading] = useState(false);

    const fetchInvites = useCallback(async () => {
        if (!userId) return;
        setLoading(true);
        try {
            const { data, error } = await (supabase
                .from('portal_invites' as any)
                .select('*')
                .eq('admin_id', userId)
                .order('created_at', { ascending: false }) as any);

            if (error) throw error;
            setInvites((data as unknown as PortalInvite[]) || []);
        } catch (err) {
            console.error('Erro ao buscar convites:', err);
        } finally {
            setLoading(false);
        }
    }, [userId]);

    useEffect(() => { fetchInvites(); }, [fetchInvites]);

    // ── Criar convite ──
    const createInvite = async (opts: {
        label: string;
        access_level: InviteAccessLevel;
        max_uses?: number | null;
        expires_at?: string | null;
    }): Promise<PortalInvite | null> => {
        if (!userId) return null;

        const code = generateInviteCode(opts.access_level);

        try {
            const { data, error } = await (supabase
                .from('portal_invites' as any)
                .insert({
                    admin_id: userId,
                    code,
                    access_level: opts.access_level,
                    label: opts.label || code,
                    max_uses: opts.max_uses ?? null,
                    expires_at: opts.expires_at ?? null,
                } as any)
                .select()
                .single() as any);

            if (error) throw error;

            const invite = data as unknown as PortalInvite;
            setInvites(prev => [invite, ...prev]);
            toast.success('Convite criado com sucesso!');
            return invite;
        } catch (err) {
            console.error('Erro ao criar convite:', err);
            toast.error('Erro ao criar convite. Tente novamente.');
            return null;
        }
    };

    // ── Revogar / reativar ──
    const toggleInvite = async (id: string, is_active: boolean) => {
        try {
            const { error } = await (supabase
                .from('portal_invites' as any)
                .update({ is_active } as any)
                .eq('id', id)
                .eq('admin_id', userId as string) as any);

            if (error) throw error;

            setInvites(prev =>
                prev.map(inv => inv.id === id ? { ...inv, is_active } : inv)
            );
            toast.success(is_active ? 'Convite reativado!' : 'Convite revogado!');
        } catch (err) {
            console.error('Erro ao atualizar convite:', err);
            toast.error('Erro ao atualizar convite.');
        }
    };

    // ── Deletar ──
    const deleteInvite = async (id: string) => {
        try {
            const { error } = await (supabase
                .from('portal_invites' as any)
                .delete()
                .eq('id', id)
                .eq('admin_id', userId as string) as any);

            if (error) throw error;

            setInvites(prev => prev.filter(inv => inv.id !== id));
            toast.success('Convite removido.');
        } catch (err) {
            console.error('Erro ao deletar convite:', err);
            toast.error('Erro ao deletar convite.');
        }
    };

    // ── Validar código de convite (chamado pelo Portal) ──
    const validateInviteCode = async (
        adminId: string,
        code: string
    ): Promise<InviteAccessLevel | null> => {
        try {
            const { data, error } = await (supabase
                .from('portal_invites' as any)
                .select('*')
                .eq('admin_id', adminId)
                .eq('code', code.trim().toUpperCase())
                .eq('is_active', true)
                .maybeSingle() as any);

            if (error || !data) return null;

            const invite = data as unknown as PortalInvite;

            // Verifica expiração
            if (invite.expires_at && new Date(invite.expires_at) < new Date()) return null;

            // Verifica usos máximos
            if (invite.max_uses !== null && invite.uses_count >= invite.max_uses) return null;

            // Incrementa contador de usos (fire-and-forget)
            (supabase
                .from('portal_invites' as any)
                .update({ uses_count: invite.uses_count + 1 } as any)
                .eq('id', invite.id) as any)
                .then(() => { });

            return invite.access_level;
        } catch {
            return null;
        }
    };

    return {
        invites,
        loading,
        fetchInvites,
        createInvite,
        toggleInvite,
        deleteInvite,
        validateInviteCode,
    };
}
