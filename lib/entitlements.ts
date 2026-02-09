type Entitlements = {
  canUsePlaid: boolean;
  canUseAi: boolean;
  tier: 'free' | 'pro';
};

export function getEntitlements(isSignedIn: boolean): Entitlements {
  if (!isSignedIn) {
    return { canUsePlaid: false, canUseAi: false, tier: 'free' };
  }
  return { canUsePlaid: true, canUseAi: true, tier: 'pro' };
}

