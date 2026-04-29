import { useState, useEffect, useRef, useCallback } from 'react';
import { useNetworkStatus } from './useNetworkStatus';

/**
 * useOfflineQuery
 * ──────────────────────────────────────────────────────────────────────────────
 * Wrapper inteligente para buscas ao Supabase com fallback offline.
 *
 * Comportamento:
 * - Quando ONLINE: busca normalmente e salva o resultado em localStorage
 * - Quando OFFLINE: lê os dados salvos e exibe, com flag `isOfflineData: true`
 * - `staleMs`: tempo em ms antes de rebuscar ao focar a janela (padrão: 5min)
 *
 * Uso:
 *   const { data, loading, isOfflineData } = useOfflineQuery(
 *     'employees-list',          // chave única no localStorage
 *     () => supabase.from('employees').select('*'),  // função de busca
 *   );
 */

interface OfflineQueryResult<T> {
  data: T | null;
  loading: boolean;
  isOfflineData: boolean;
  refetch: () => void;
}

const STORAGE_PREFIX = 'saude_cache_';
const DEFAULT_STALE_MS = 5 * 60 * 1000; // 5 minutos

export function useOfflineQuery<T>(
  cacheKey: string,
  queryFn: () => Promise<{ data: T | null; error: unknown }>,
  staleMs: number = DEFAULT_STALE_MS,
): OfflineQueryResult<T> {
  const { isOnline } = useNetworkStatus();
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOfflineData, setIsOfflineData] = useState(false);

  const lastFetchedAt = useRef<number>(0);
  const storageKey = `${STORAGE_PREFIX}${cacheKey}`;
  const tsKey = `${storageKey}_ts`;

  // ── Lê do localStorage ────────────────────────────────────────────────────
  const readCache = useCallback((): T | null => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return null;
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }, [storageKey]);

  // ── Salva no localStorage ─────────────────────────────────────────────────
  const writeCache = useCallback((result: T) => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(result));
      localStorage.setItem(tsKey, String(Date.now()));
    } catch {
      // localStorage cheio — ignora silenciosamente
    }
  }, [storageKey, tsKey]);

  // ── Lógica de busca ───────────────────────────────────────────────────────
  const fetch = useCallback(async (force = false) => {
    const now = Date.now();
    const isFresh = now - lastFetchedAt.current < staleMs;

    // Se os dados ainda são frescos e não é forçado, não rebusca
    if (isFresh && !force && data !== null) return;

    if (!isOnline) {
      // Offline: usa cache salvo
      const cached = readCache();
      if (cached !== null) {
        setData(cached);
        setIsOfflineData(true);
      }
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data: result } = await queryFn();
      if (result !== null && result !== undefined) {
        setData(result);
        writeCache(result);
        setIsOfflineData(false);
        lastFetchedAt.current = Date.now();
      } else {
        // Se a query retornou null, tenta o cache
        const cached = readCache();
        if (cached !== null) {
          setData(cached);
          setIsOfflineData(true);
        }
      }
    } catch {
      // Erro de rede — usa cache
      const cached = readCache();
      if (cached !== null) {
        setData(cached);
        setIsOfflineData(true);
      }
    } finally {
      setLoading(false);
    }
  }, [isOnline, data, staleMs, queryFn, readCache, writeCache]);

  // ── Efeito inicial: carrega cache imediatamente, depois tenta rede ────────
  useEffect(() => {
    const cached = readCache();
    if (cached !== null) {
      setData(cached);
      setIsOfflineData(!isOnline);
      setLoading(false);
    }
    fetch();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Quando volta online: rebusca automaticamente ──────────────────────────
  useEffect(() => {
    if (isOnline) fetch(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline]);

  return {
    data,
    loading,
    isOfflineData,
    refetch: () => fetch(true),
  };
}
