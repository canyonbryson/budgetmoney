import { resolvePostAuthPath } from '../authNavigation';

describe('resolvePostAuthPath', () => {
  it('returns root when returnTo is missing', () => {
    expect(resolvePostAuthPath(undefined)).toBe('/');
  });

  it('returns root when returnTo is an array', () => {
    expect(resolvePostAuthPath(['/(onboarding)/budget'])).toBe('/');
  });

  it('returns root when returnTo is blank', () => {
    expect(resolvePostAuthPath('   ')).toBe('/');
  });

  it('returns root for non-app paths', () => {
    expect(resolvePostAuthPath('https://evil.example')).toBe('/');
    expect(resolvePostAuthPath('onboarding/budget')).toBe('/');
  });

  it('returns the provided app path when valid', () => {
    expect(resolvePostAuthPath('/(onboarding)/budget')).toBe('/(onboarding)/budget');
  });

  it('allows family invite accept paths', () => {
    expect(resolvePostAuthPath('/(screens)/family-accept/abc123')).toBe(
      '/(screens)/family-accept/abc123'
    );
  });
});
