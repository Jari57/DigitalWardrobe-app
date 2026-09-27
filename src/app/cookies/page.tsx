import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Cookies and device storage — FitStalker',
  alternates: { canonical: '/cookies' },
};

export default function CookiesPage() {
  return (
    <main className="legal-page">
      <a href="/">← Back to FitStalker</a>
      <h1>Cookies and device storage</h1>
      <p>Updated September 27, 2026</p>
      <p>
        FitStalker uses a sign-in cookie and device storage for your selected theme and installed
        app. We do not use advertising cookies or third-party analytics trackers. Cookieless
        first-party page-view counts help us understand site use.
      </p>
      <h2>Sign-in</h2>
      <p>
        The <code>__Host-wardrobe-session</code> cookie keeps you signed in for up to 30 days. It
        contains a random session token, not your password. It is Secure, HttpOnly and SameSite=Lax.
        Signing out removes the current session. Blocking this cookie prevents account features from
        working.
      </p>
      <h2>Your theme</h2>
      <p>
        The <code>wardrobe-theme</code> preference in local storage remembers light, dark or system
        mode. It has no automatic expiry. Use the theme button to change it, or clear this site's
        browser data to remove it. This preference is not an advertising identifier.
      </p>
      <h2>Installed app and screenshots</h2>
      <p>
        The service worker stores the public offline page and app icons in Cache Storage. It does
        not cache your private wardrobe or AI responses. Public files remain until an app update or
        until you clear browser storage. A screenshot shared into the installed app is held in
        memory for at most two minutes for a one-time handoff; it is not written to the offline
        cache. Selecting Identify clothes uploads your chosen photo for processing.
      </p>
      <h2>Google and external sites</h2>
      <p>
        Google sign-in opens a Google/Firebase authentication flow that may use its own cookies.
        Publisher images and external retailer links contact those providers. Their practices are
        separate from this site's session and theme storage.
      </p>
      <h2>Your controls</h2>
      <p>
        Sign out through Account settings to end this device's session. Your browser's site-data
        settings can remove cookies, local preferences and offline files for fitstalker.com.
        Clearing browser data signs you out and may affect PWA installation, but does not delete
        your server account. Delete your account separately in Account settings if that is what you
        want.
      </p>
      <p>
        Our cookieless page-view counter stores only the UTC day, page category, broad referral
        channel, device category and sign-in status. It creates no visitor identifier and uses no
        analytics cookies or device storage. It respects Do Not Track and Global Privacy Control.
        Counts older than 90 days are removed on subsequent traffic collection. Blocked scripts are
        not counted.
      </p>
    </main>
  );
}
