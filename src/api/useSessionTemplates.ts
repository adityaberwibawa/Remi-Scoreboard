/** Hook pemuat template remote: cache-first, loading, error, retry, dan refresh saat online. */
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { apiErrorMessage, isAbortError } from './errors';
import {
  DEFAULT_USE_MOCK,
  fetchSessionTemplates,
  readCachedTemplateList,
  type TemplateSource,
} from './client';
import type { SessionTemplate } from './dto';
import { useNetworkStatus } from '../hooks/useNetworkStatus';

interface UseSessionTemplatesResult {
  templates: SessionTemplate[];
  /** True hanya saat belum ada data yang bisa ditampilkan. */
  loading: boolean;
  /** True saat memperbarui data yang sudah tampil. */
  refreshing: boolean;
  error: string | null;
  source: TemplateSource;
  cachedAt: string | null;
  retry: () => void;
  refresh: () => void;
}

const STALE_AFTER_MS = 5 * 60_000;

export function useSessionTemplates(useMock = DEFAULT_USE_MOCK): UseSessionTemplatesResult {
  const [templates, setTemplates] = useState<SessionTemplate[]>([]);
  const [source, setSource] = useState<TemplateSource>('network');
  const [cachedAt, setCachedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const networkStatus = useNetworkStatus();

  const templatesRef = useRef(templates);
  const errorRef = useRef(error);
  const lastSuccessAt = useRef(0);
  const wasOffline = useRef(false);

  useEffect(() => {
    templatesRef.current = templates;
  }, [templates]);

  useEffect(() => {
    errorRef.current = error;
  }, [error]);

  /** Dipanggil dari event handler/effect lain, bukan dari badan effect pemuatan. */
  const beginRefresh = useCallback(() => {
    setError(null);
    if (templatesRef.current.length > 0) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setAttempt((n) => n + 1);
  }, []);

  useEffect(() => {
    let active = true;
    let networkDone = false;
    const controller = new AbortController();
    const hasData = templatesRef.current.length > 0;

    // Tampilkan cache dulu agar layar tidak kosong saat jaringan lambat/offline.
    if (!hasData) {
      readCachedTemplateList()
        .then((cached) => {
          if (!active || networkDone || !cached || cached.templates.length === 0) return;
          setTemplates(cached.templates);
          setSource('cache');
          setCachedAt(cached.cachedAt);
          setLoading(false);
        })
        .catch(() => undefined);
    }

    fetchSessionTemplates({ useMock, signal: controller.signal })
      .then((result) => {
        if (!active) return;
        networkDone = true;
        setTemplates(result.templates);
        setSource(result.source);
        setCachedAt(result.cachedAt);
        setError(null);
        if (result.source === 'network') lastSuccessAt.current = Date.now();
      })
      .catch((e) => {
        if (!active || isAbortError(e)) return;
        networkDone = true;
        setError(apiErrorMessage(e, 'Gagal memuat template.'));
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
        setRefreshing(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [useMock, attempt]);

  // Muat ulang otomatis setelah koneksi kembali.
  useEffect(() => {
    if (networkStatus === 'offline') {
      wasOffline.current = true;
      return;
    }
    if (networkStatus === 'online' && wasOffline.current) {
      wasOffline.current = false;
      beginRefresh();
    }
  }, [networkStatus, beginRefresh]);

  // Saat aplikasi kembali aktif: segarkan bila sebelumnya error atau data sudah basi.
  useEffect(() => {
    if (useMock) return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      const stale = Date.now() - lastSuccessAt.current > STALE_AFTER_MS;
      if (errorRef.current || stale) beginRefresh();
    });
    return () => sub.remove();
  }, [useMock, beginRefresh]);

  return {
    templates,
    loading,
    refreshing,
    error,
    source,
    cachedAt,
    retry: beginRefresh,
    refresh: beginRefresh,
  };
}
