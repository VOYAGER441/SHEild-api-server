# SHEild Backend

The **SHEild Backend** is a robust Node.js/Express application designed to support the SHEild Women's Safety App. Its primary role is to verify Google ID tokens from the native mobile sign-in, manage user sessions via custom JWTs, and handle additional verification logic and data storage using MongoDB.

## Features

- **Native Google Auth**: Verifies Google ID tokens server-side with `google-auth-library` (no third-party BaaS).
- **Custom Authentication**: Issues custom access/refresh JWTs after Google verification.
- **User Management**: Manages user data in a MongoDB database.
- **Safety Logic**: (Planned) Backend logic for safety checks and verification.

## Prerequisites

Before you begin, ensure you have the following installed:

- [Node.js](https://nodejs.org/) (v16 or higher recommended)
- [npm](https://www.npmjs.com/) or [yarn](https://yarnpkg.com/)
- A [MongoDB](https://www.mongodb.com/) database
- Google OAuth client IDs ([Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials)

## Installation

1.  **Clone the repository:**
    ```bash
    git clone <repository_url>
    cd sheild_api_server
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

## Configuration

Create a `.env` file in the root directory of the project and configure the following environment variables:

```env
# Server Configuration
PORT=5000

# Database
MONGODB_URI=mongodb://localhost:27017/SHEild

# Google OAuth client IDs (audiences accepted when verifying ID tokens)
GOOGLE_CLIENT_ID_WEB=xxxxxxxxxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_ID_ANDROID=  # optional
GOOGLE_CLIENT_ID_IOS=      # optional

# JWT Configuration
JWT_SECRET=your_super_secret_jwt_key
JWT_REFRESH_SECRET=your_refresh_secret # optional; falls back to JWT_SECRET

# Optional: AI & Logging (if applicable)
LOG_LEVEL=info
```

### Environment Variable Details

- `PORT`: The port on which the server will run (default: 5000).
- `MONGODB_URI`: Connection string for your MongoDB database.
- `GOOGLE_CLIENT_ID_WEB`: The "Web application" OAuth client ID. Native ID tokens minted for this audience are accepted by `POST /auth/google`.
- `GOOGLE_CLIENT_ID_ANDROID` / `GOOGLE_CLIENT_ID_IOS`: Optional extra audiences for Android/iOS OAuth clients.
- `JWT_SECRET`: A strong secret key used to sign and verify custom backend JWTs.
- `JWT_REFRESH_SECRET`: Dedicated secret for refresh tokens. Falls back to `JWT_SECRET` when unset.

## Running the Server

### Development Mode
Runs the server with `nodemon` for hot-reloading:
```bash
npm run dev
```

### Production Mode
Builds and runs the compiled JavaScript:
```bash
npm run build
npm start
```

## API Documentation

All routes are mounted under `/v1`; `/api/v1` is an alias with identical behavior.

### Authentication

#### Google Sign-In (native)
Exchanges a Google ID token for the backend session tokens. This is the
primary (and only) mobile login: the app obtains the ID token from the native
Google Sign-In SDK and the backend verifies it directly with Google via
`google-auth-library` — no browser redirect, no third-party auth service.

- **Endpoint**: `POST /v1/auth/google` (alias: `POST /api/v1/auth/google`,
  legacy alias `POST /v1/auth/google/native`)
- **Description**: Verifies the Google signature, audience (web/Android/iOS
  client IDs) and expiry, then finds the user by `googleId` (or by email for
  first-time native sign-in, linking the `googleId`), creating the user if
  needed. Returns the backend access/refresh JWT pair plus the user profile.
  Rate limited to 20 requests per 15 minutes per IP.

**Request:**
```http
POST /v1/auth/google
Content-Type: application/json

{ "idToken": "<google_id_token>" }
```

**Example Response (Success):**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsIn...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsIn...",
  "user": {
    "id": "60d0fe4f5311236168a109ca",
    "email": "user@example.com",
    "name": "Jane Doe",
    "avatarUrl": "https://...",
    "role": "user"
  }
}
```

**Errors:**

| Status | Meaning |
| ------ | ------- |
| `400`  | Missing or malformed `idToken` |
| `401`  | Google rejected the token (audience mismatch, expired, bad signature) |
| `429`  | Too many sign-in attempts |
| `500`  | No `GOOGLE_CLIENT_ID_*` configured on the server |

**Required configuration:** a Google OAuth **Web application** client ID in
`GOOGLE_CLIENT_ID_WEB`, matching the `webClientId` the mobile app passes to
`GoogleSignin.configure()`. No client secret is needed for native sign-in.

#### Refresh token rotation
Exchanges a still-valid refresh token for a new access/refresh pair. The old
refresh token is revoked in the `auth` session collection (sha256-hashed,
unique, 7-day TTL); reuse of a revoked token returns `401`.

- **Endpoint**: `POST /v1/auth/refresh` (alias: `POST /api/v1/auth/refresh`)
- Rate limited to 30 requests per 15 minutes per IP.

**Request:**
```http
POST /v1/auth/refresh
Content-Type: application/json

{ "refreshToken": "<current_refresh_token>" }
```

**Example Response (Success):** same shape as `POST /v1/auth/google` —
`accessToken`, `refreshToken` (new), `user`.

**Errors:**

| Status | Meaning |
| ------ | ------- |
| `400`  | Missing or malformed `refreshToken` |
| `401`  | Unknown, revoked, expired, or wrong-type (access) token |
| `429`  | Too many refresh attempts |

#### Google OAuth 2.0 bridge (browser fallback for Expo Go)
Used by the mobile app when the native Google SDK is unavailable (e.g. Expo Go).
`GET /v1/auth/google/callback` is the Google redirect target. Its JS reads the
`id_token` from the URL fragment (fragments are never sent to servers) and
hands it to the backend via `POST /v1/auth/google/browser-session/:sessionId`
(the `state` param carries the app-generated sessionId). The app polls
`GET /v1/auth/google/browser-session/:sessionId` until the token appears
(one-time read, 5-minute TTL), then completes login via `POST /v1/auth/google`
exactly as native sign-in does. No `sheild://` deep link is required, so the
flow works in Expo Go (where custom schemes are not registered). The page also
shows a best-effort deep-link button for dev/standalone builds.

**Required configuration:** register `https://<your-host>:<port>/v1/auth/google/callback`
as an **Authorised redirect URI** in the Google Cloud Console OAuth client (Web
application). In local development, tunnel or expose the backend (e.g. ngrok)
and register the resulting HTTPS URL — and remember it changes when ngrok
restarts.

## Project Structure

The project follows a standard Express MVC architecture:

```
src/
├── controllers/    # Request handlers and business logic
├── database/       # Database connection logic
├── environment/    # Environment variable configuration
├── error/          # Error handling middleware and classes
├── interface/      # TypeScript interfaces and types
├── middleware/     # Custom Express middleware
├── models/         # Mongoose schema definitions
├── routes/         # API route definitions
├── services/       # Business logic services (if separated from controllers)
├── utils/          # Utility functions (logger, formatting, etc.)
└── app.ts          # App entry point
```
