import React from 'react';

import { initLocalDb } from '@/lib/localDb';

type LocalDbContextValue = {
  ready: boolean;
  error: string | null;
  refreshKey: number;
  bumpRefresh: () => void;
};

const LocalDbContext = React.createContext<LocalDbContextValue>({
  ready: false,
  error: null,
  refreshKey: 0,
  bumpRefresh: () => undefined,
});

export function LocalDbProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [refreshKey, setRefreshKey] = React.useState(0);

  React.useEffect(() => {
    let isMounted = true;
    (async () => {
      let timeoutId: ReturnType<typeof setTimeout> | null = null;
      try {
        const timeout = new Promise((_, reject) => {
          timeoutId = setTimeout(
            () => reject(new Error('Local database initialization timed out.')),
            5000
          );
        });
        await Promise.race([initLocalDb(), timeout]);
      } catch (err: any) {
        if (isMounted) {
          const message = err?.message ?? 'Failed to initialize local storage.';
          setError(message);
          if (__DEV__) {
            console.error('[LocalDb] init failed', message);
          }
        }
      } finally {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        if (isMounted) setReady(true);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  const bumpRefresh = React.useCallback(() => {
    setRefreshKey((prev) => prev + 1);
  }, []);

  return (
    <LocalDbContext.Provider value={{ ready, error, refreshKey, bumpRefresh }}>
      {children}
    </LocalDbContext.Provider>
  );
}

export function useLocalDb() {
  return React.useContext(LocalDbContext);
}
