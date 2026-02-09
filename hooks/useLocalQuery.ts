import React from 'react';

import { useLocalDb } from '@/contexts/LocalDbContext';

type LocalQueryState<T> = {
  data: T | undefined;
  error: Error | null;
  loading: boolean;
};

export function useLocalQuery<T>(
  queryFn: () => Promise<T>,
  deps: React.DependencyList,
  enabled = true
): LocalQueryState<T> {
  const { ready, refreshKey, error: localError } = useLocalDb();
  const [state, setState] = React.useState<LocalQueryState<T>>({
    data: undefined,
    error: null,
    loading: false,
  });

  React.useEffect(() => {
    let isMounted = true;
    if (!enabled || !ready || localError) {
      setState((prev) => ({
        ...prev,
        data: undefined,
        loading: false,
        error: localError ? new Error(localError) : null,
      }));
      return;
    }
    setState({ data: undefined, error: null, loading: true });
    queryFn()
      .then((result) => {
        if (!isMounted) return;
        setState({ data: result, error: null, loading: false });
      })
      .catch((err: any) => {
        if (!isMounted) return;
        setState({ data: undefined, error: err as Error, loading: false });
      });
    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ready, refreshKey, localError, ...deps]);

  return state;
}
