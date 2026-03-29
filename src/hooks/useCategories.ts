import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAppData } from './useAppData';

export interface Category {
  id: string;
  team_id: string;
  name: string;
  color: string;
  active: boolean;
  created_at: string;
}

export function useCategories() {
  const { teamId } = useAppData();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCategories = useCallback(async () => {
    if (!teamId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('categories' as any)
        .select('*')
        .eq('team_id', teamId)
        .order('name') as any;
      if (error) throw error;
      setCategories((data || []) as Category[]);
    } catch (err) {
      console.error('Erro ao carregar categorias:', err);
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  useEffect(() => { fetchCategories(); }, [fetchCategories]);

  const addCategory = useCallback(async (name: string, color: string) => {
    if (!teamId) return null;
    const { data, error } = await supabase
      .from('categories' as any)
      .insert({ team_id: teamId, name, color } as any)
      .select()
      .single() as any;
    if (error) throw error;
    await fetchCategories();
    return data as Category;
  }, [teamId, fetchCategories]);

  const updateCategory = useCallback(async (id: string, updates: Partial<Pick<Category, 'name' | 'color' | 'active'>>) => {
    const { error } = await supabase
      .from('categories' as any)
      .update(updates as any)
      .eq('id', id) as any;
    if (error) throw error;
    await fetchCategories();
  }, [fetchCategories]);

  const deleteCategory = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('categories' as any)
      .delete()
      .eq('id', id) as any;
    if (error) throw error;
    await fetchCategories();
  }, [fetchCategories]);

  return { categories, loading, addCategory, updateCategory, deleteCategory, refresh: fetchCategories };
}
