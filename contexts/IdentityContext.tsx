import React from 'react';
import { useAuth } from '@clerk/clerk-expo';
import { useMutation, useQuery } from 'convex/react';

import { getOrCreateDeviceId } from '@/lib/deviceId';
import { getEntitlements } from '@/lib/entitlements';
import { clearLocalDirty, exportLocalData, isLocalDirty } from '@/lib/localDb';
import { useLocalDb } from '@/contexts/LocalDbContext';
import { api } from '@/convex/_generated/api';

export type Owner = {
  ownerType: 'device' | 'user' | 'family';
  ownerId: string;
};

type IdentityContextValue = {
  deviceId: string | null;
  owner: Owner | null;
  isSignedIn: boolean;
  entitlements: ReturnType<typeof getEntitlements>;
  isReady: boolean;
  familyName: string | null;
};

const IdentityContext = React.createContext<IdentityContextValue>({
  deviceId: null,
  owner: null,
  isSignedIn: false,
  entitlements: getEntitlements(false),
  isReady: false,
  familyName: null,
});

export function IdentityProvider({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn, userId } = useAuth();
  const signedIn = Boolean(isSignedIn);
  const [deviceId, setDeviceId] = React.useState<string | null>(null);
  const [hasMerged, setHasMerged] = React.useState(false);
  const [mergeAttemptedFor, setMergeAttemptedFor] = React.useState<string | null>(null);
  const [hasEnsuredUser, setHasEnsuredUser] = React.useState(false);
  const { ready: localReady, error: localError } = useLocalDb();

  const ensureUser = useMutation(api.users.ensure);
  const mergeDevice = useMutation(api.users.mergeDeviceToUser);
  const importLocalData = useMutation(api.users.importLocalData);
  const myFamily = useQuery(api.families.getMyFamily, signedIn ? {} : 'skip');

  React.useEffect(() => {
    let isMounted = true;
    (async () => {
      const id = await getOrCreateDeviceId();
      if (isMounted) setDeviceId(id);
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  React.useEffect(() => {
    if (!deviceId || !isLoaded || !signedIn) return;
    void (async () => {
      await ensureUser({ deviceId });
      setHasEnsuredUser(true);
    })();
  }, [deviceId, isLoaded, signedIn, ensureUser]);

  React.useEffect(() => {
    if (!signedIn) {
      setHasEnsuredUser(false);
    }
  }, [signedIn]);

  React.useEffect(() => {
    if (!deviceId || !isLoaded || !signedIn || !userId || hasMerged) return;
    void (async () => {
      await mergeDevice({ deviceId });
      setHasMerged(true);
    })();
  }, [deviceId, isLoaded, signedIn, userId, hasMerged, mergeDevice]);

  React.useEffect(() => {
    if (!signedIn) {
      setMergeAttemptedFor(null);
    }
  }, [signedIn]);

  React.useEffect(() => {
    if (!signedIn || !userId || !localReady || mergeAttemptedFor === userId) return;
    void (async () => {
      try {
        const dirty = await isLocalDirty();
        if (!dirty) return;
        const payload = await exportLocalData();
        await importLocalData({ data: payload as any });
        await clearLocalDirty();
      } finally {
        setMergeAttemptedFor(userId);
      }
    })();
  }, [signedIn, userId, localReady, mergeAttemptedFor, importLocalData]);

  const owner: Owner | null = React.useMemo(() => {
    if (!deviceId || !isLoaded) return null;
    if (signedIn && userId) {
      if (!hasEnsuredUser) return null;
      if (!myFamily?.familyId) return null;
      return { ownerType: 'family', ownerId: myFamily.familyId };
    }
    return { ownerType: 'device', ownerId: deviceId };
  }, [deviceId, isLoaded, signedIn, userId, hasEnsuredUser, myFamily]);

  const entitlements = React.useMemo(() => getEntitlements(signedIn), [signedIn]);

  return (
    <IdentityContext.Provider
      value={{
        deviceId,
        owner,
        isSignedIn: signedIn,
        entitlements,
        isReady: Boolean(deviceId && isLoaded && (signedIn || localReady || localError)),
        familyName: myFamily?.familyName ?? null,
      }}
    >
      {children}
    </IdentityContext.Provider>
  );
}

export function useIdentity() {
  return React.useContext(IdentityContext);
}
