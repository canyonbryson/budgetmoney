export type PostAuthPath = '/' | '/(onboarding)/budget' | `/(screens)/family-accept/${string}`;

export function resolvePostAuthPath(returnTo?: string | string[]): PostAuthPath {
  if (typeof returnTo !== 'string') {
    return '/';
  }

  const trimmed = returnTo.trim();
  if (trimmed === '/(onboarding)/budget') {
    return trimmed;
  }
  if (trimmed.startsWith('/(screens)/family-accept/')) {
    return trimmed as PostAuthPath;
  }

  return '/';
}
