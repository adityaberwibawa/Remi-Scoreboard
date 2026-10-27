/** Hook pemuat template remote: loading / error / retry (pola Slide Task 02). */
import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_USE_MOCK, fetchSessionTemplates } from './client';
import type { SessionTemplate } from './dto';

interface UseSessionTemplatesResult {
  templates: SessionTemplate[];
  loading: boolean;
  error: string | null;
  retry: () => void;
}

export function useSessionTemplates(useMock = DEFAULT_USE_MOCK): UseSessionTemplatesResult {
  const [templates, setTemplates] = useState<SessionTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    fetchSessionTemplates({ useMock, signal: controller.signal })
      .then((data) => {
        if (active) setTemplates(data);
      })
      .catch((e) => {
        if (e instanceof DOMException && e.name === 'AbortError') return;
        if (active) {
          setTemplates([]);
          setError(e instanceof Error ? e.message : 'Gagal memuat template.');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [useMock, attempt]);

  const retry = useCallback(() => {
    setLoading(true);
    setError(null);
    setAttempt((n) => n + 1);
  }, []);

  return { templates, loading, error, retry };
}
