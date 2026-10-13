# Production Google Login Setup

> How to take Google sign-in from Expo Go / local dev to a production build.
> Covers Google Cloud Console, backend deployment, and app build config.
> Last Updated: October 13, 2026

---

## Overview

| Environment | Sign-in path |
|-------------|-------------|
| Expo Go (dev) | Browser fallback only — native SDK is not in the Expo Go binary |
| Dev build / production build | **Native Google Sign-In** (account-picker modal) primary; browser fallback still works |

In production the app ships a real native build (EAS build / `expo prebuild`), so the native SDK is included and the browser flow is only a fallback. No code changes are required — only configuration.

---

## 1. Google Cloud Console

Console: <https://console.cloud.google.com> → your project.

### 1.1 OAuth consent screen

- User type: **External**
- Click **Publish app** (leave "Testing" mode)
  - While in Testing mode, only added test users can sign in — this is the usual cause of "Access blocked: This app's request is invalid"
- Scopes: `openid`, `email`, `profile` (what the app already requests)

### 1.2 Android OAuth client (new)

Created for the native Android sign-in path:

- **Application type:** Android
- **Package name:** from `app.json` / `expo.extra.eas.projectId` app config (e.g. `com.yourname.sheild`)
- **SHA-1 certificate fingerprint:** of the **production/upload keystore**

Get the SHA-1:

```bash
# EAS-managed credentials
eas credentials → Android → Production → "Google Services / SHA-1"

# Or from a keystore file directly
keytool -list -v -keystore upload.keystore -alias upload
```

### 1.3 iOS OAuth client (new)

- **Application type:** iOS
- **Bundle ID:** from your `app.json` / Xcode project (e.g. `com.yourname.sheild`)

### 1.4 Web client (existing — used for ID-token audience + browser fallback)

The Web client ID `933916640780-....apps.googleusercontent.com` is:

- the `webClientId` passed to `GoogleSignin.configure()` — the audience baked into the native ID token the backend verifies
- the client for the browser fallback OAuth flow

**Authorised redirect URIs** — replace any dev/ngrok entries with:

```
https://api.yourdomain.com/v1/auth/google/callback
```

> ngrok URLs change on every restart — they are dev-only. The production
> backend URL is permanent.

---

## 2. Backend deployment

Deploy the API with **HTTPS** (Render, Railway, Fly.io, or a VPS behind
Caddy/nginx). HTTPS is mandatory: Google only accepts `https://` redirect
URIs except for `localhost`.

### 2.1 Production `.env`

```env
NODE_ENV=production

# Strong random values — production refuses to start without JWT_SECRET
JWT_SECRET=<long random string, e.g. openssl rand -hex 64>
JWT_REFRESH_SECRET=<a DIFFERENT long random string>

# Google OAuth audiences — all three should match the clients above
GOOGLE_CLIENT_ID_WEB=933916640780-....apps.googleusercontent.com
GOOGLE_CLIENT_ID_ANDROID=<android client id>.apps.googleusercontent.com
GOOGLE_CLIENT_ID_IOS=<ios client id>.apps.googleusercontent.com

# Managed MongoDB (Atlas, etc.) — not localhost
MONGODB_URI=mongodb+srv://...

# Public URL of this backend (used in logs / future flows)
APP_URL=https://api.yourdomain.com

# Now safe to shorten — refresh rotation exists
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=30d
```

### 2.2 Notes

- **Single instance:** the browser-session handoff store
  (`POST/GET /v1/auth/google/browser-session/:sessionId`) is in-memory with a
  5-minute TTL. Fine for one process. If you scale to multiple instances
  (PM2 cluster, multiple containers), either move the store to Redis/Mongo or
  rely on native sign-in only (the browser fallback is rarely used in
  production builds).
- **CORS:** the server currently uses `cors()` (allow all). Harmless for a
  native app, but you can restrict it to your web domains if you also serve a
  web client.
- **Rate limits** are already in place: 20/15min on `/auth/google`,
  30/15min on `/auth/refresh`.

---

## 3. App build configuration

### 3.1 `eas.json` (production profile)

```json
{
  "build": {
    "production": {
      "env": {
        "EXPO_PUBLIC_BACKEND_BASE_URL": "https://api.yourdomain.com",
        "EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID": "933916640780-....apps.googleusercontent.com",
        "EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID": "<ios client id>.apps.googleusercontent.com"
      }
    }
  }
}
```

### 3.2 Build and run

```bash
# Development build (replaces Expo Go for daily work)
eas build --profile development --platform android

# Production
eas build --profile production --platform all
```

### 3.3 What the code already does (no changes needed)

- `services/googleSignin.ts` — configures the native SDK with `webClientId`
  (and `iosClientId` when set); warns and returns when the native module is
  absent (Expo Go), so the browser fallback kicks in automatically
- `services/googleAuthBrowser.ts` — browser fallback: opens the Web OAuth
  implicit flow, bridge page hands the `id_token` to the backend, app polls
  for it (works without deep links, so it works in Expo Go and in production)
- Backend verifies the ID token against **all** configured client IDs
  (`GOOGLE_TOKEN_AUDIENCES`), so the same `/v1/auth/google` endpoint serves
  native and browser sign-in

---

## 4. Optional hardening

- **JWT expiry:** now that `POST /v1/auth/refresh` rotation is live, shorten
  `JWT_EXPIRES_IN` to `15m` (see `.env` above) — a leaked access token then
  dies quickly
- **App Links (verified https links):** add `intentFilters` to `app.json` and
  a `assetlinks.json` if you want `https://` links to open the app directly
  instead of the `sheild://` scheme (scheme links already work in standalone
  builds; they cannot work in Expo Go)
- **Key rotation:** if a Google client ID or JWT secret is ever compromised,
  rotate it in Cloud Console / server env; sessions signed with the old
  refresh secret fail and users re-sign-in

---

## 5. Troubleshooting

| Symptom | Cause / fix |
|---------|-------------|
| "Access blocked: This app's request is invalid" | Consent screen still in Testing → publish, or add the Google account as a test user |
| "Access blocked" persists after publishing | Redirect URI not registered on the Web client, or client ID mismatch between app `.env` and server `.env` |
| Native sign-in: `RNGoogleSignin` not in this build | Running in Expo Go — use a dev/production build |
| Native sign-in: `DEVELOPER_ERROR` | Android client SHA-1 or package name mismatch — re-check §1.2 |
| Browser sign-in times out | Bridge page never posted the result — check the backend callback is reachable over HTTPS and registered in Cloud Console |
| Works in dev, 401 in production | `GOOGLE_CLIENT_ID_*` not set on the production server, or `NODE_ENV=production` with mismatched `JWT_SECRET` after a redeploy (users must sign in again) |

---

**Developer:** Mainak
**Project:** SHEild Women's Safety App
