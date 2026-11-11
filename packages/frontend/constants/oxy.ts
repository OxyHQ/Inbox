/**
 * Oxy platform integration constants for the inbox app.
 */

/**
 * Public OAuth client id for this app (the registered `ApplicationCredential`
 * publicKey). Drives the #214 app-identity flow when passed to `OxyProvider`.
 * Public value — safe to commit. Overridable per environment via
 * `EXPO_PUBLIC_OXY_CLIENT_ID`.
 */
export const OXY_CLIENT_ID =
  process.env.EXPO_PUBLIC_OXY_CLIENT_ID ||
  'oxy_dk_19cf17069d097a6ebf17a622709a53d13692ee69487224e3';

/** The web origins registered in the Oxy application's `redirectUris` (exact match). */
const REGISTERED_WEB_ORIGINS = ['https://inbo.sh', 'https://inbox.oxy.so'];

/** The registered origin this page was loaded from, so sign-in returns to the same host. */
function currentWebOrigin(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  return REGISTERED_WEB_ORIGINS.find((origin) => origin === window.location.origin);
}

/** Registered OAuth redirect surface: this page's own origin on the web, else the build's default. */
export const OXY_AUTH_REDIRECT_URI =
  currentWebOrigin() || process.env.EXPO_PUBLIC_OXY_AUTH_REDIRECT_URI || 'https://inbox.oxy.so';
