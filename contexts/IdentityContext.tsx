import React from 'react';
import { useAuth } from '@clerk/clerk-expo';
import { useMutation } from 'convex/react';

import { getOrCreateDeviceId } from '@/lib/deviceId';
import { getEntitlements } from '@/lib/entitlements';
import { clearLocalDirty, exportLocalData, isLocalDirty } from '@/lib/localDb';
import { useLocalDb } from '@/contexts/LocalDbContext';
import { api } from '@/convex/_generated/api';

export type Owner = {
  ownerType: 'device' | 'user';
  ownerId: string;
};

type IdentityContextValue = {
  deviceId: string | null;
  owner: Owner | null;
  isSignedIn: boolean;
  entitlements: ReturnType<typeof getEntitlements>;
  isReady: boolean;
};

const IdentityContext = React.createContext<IdentityContextValue>({
  deviceId: null,
  owner: null,
  isSignedIn: false,
  entitlements: getEntitlements(false),
  isReady: false,
});

export function IdentityProvider({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn, userId } = useAuth();
  const signedIn = Boolean(isSignedIn);
  const [deviceId, setDeviceId] = React.useState<string | null>(null);
  const [hasMerged, setHasMerged] = React.useState(false);
  const [mergeAttemptedFor, setMergeAttemptedFor] = React.useState<string | null>(null);
  const { ready: localReady, error: localError } = useLocalDb();

  const ensureUser = useMutation(api.users.ensure);
  const mergeDevice = useMutation(api.users.mergeDeviceToUser);
  const importLocalData = useMutation(api.users.importLocalData);
  const bootstrapDefaults = useMutation(api.categories.bootstrapDefaults);

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
    void ensureUser({ deviceId });
  }, [deviceId, isLoaded, signedIn, ensureUser]);

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
        await importLocalData({ data: payload });
        await clearLocalDirty();
      } finally {
        setMergeAttemptedFor(userId);
      }
    })();
  }, [signedIn, userId, localReady, mergeAttemptedFor, importLocalData]);

  const owner: Owner | null = React.useMemo(() => {
    if (!deviceId || !isLoaded) return null;
    if (signedIn && userId) {
      return { ownerType: 'user', ownerId: userId };
    }
    return { ownerType: 'device', ownerId: deviceId };
  }, [deviceId, isLoaded, signedIn, userId]);

  React.useEffect(() => {
    if (!owner || !isLoaded) return;
    if (!signedIn) return;
    if (signedIn && !hasMerged) return;
    void bootstrapDefaults({ ownerType: owner.ownerType, ownerId: owner.ownerId });
  }, [owner, isLoaded, signedIn, hasMerged, bootstrapDefaults]);

  const entitlements = React.useMemo(() => getEntitlements(signedIn), [signedIn]);

  return (
    <IdentityContext.Provider
      value={{
        deviceId,
        owner,
        isSignedIn: signedIn,
        entitlements,
        isReady: Boolean(deviceId && isLoaded && (signedIn || localReady || localError)),
      }}
    >
      {children}
    </IdentityContext.Provider>
  );
}

export function useIdentity() {
  return React.useContext(IdentityContext);
}
