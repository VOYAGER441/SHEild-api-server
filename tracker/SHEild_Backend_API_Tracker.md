# SHEild Backend API Development Tracker

> **Tech Stack:** Node.js + Express + MongoDB (Mongoose) + Google OAuth (google-auth-library) + custom JWTs  
> **Mobile App:** React Native Expo (native Google Sign-In)  
> **Last Updated:** October 13, 2026

---

## 🔁 Migration Log — Native Google Auth (branch: `feat/native-google-auth`)

Replaced the Appwrite-based auth stack with direct Google ID-token verification.

| Step | Change | Status |
|------|--------|--------|
| 1 | Add `google-auth-library`, remove `node-appwrite` | ✅ |
| 2 | Env: `GOOGLE_CLIENT_ID_WEB/ANDROID/IOS`, `JWT_REFRESH_SECRET`; drop `APPWRITE_*` | ✅ |
| 3 | User model: `googleId` (sparse unique) replaces `appwriteId`; email normalized | ✅ |
| 4 | `jwtOperation`: refresh tokens signed with `JWT_REFRESH_SECRET` + `verifyRefreshToken` | ✅ |
| 5 | `POST /v1/auth/google` (+ `/api/v1` mount alias, + legacy `/google/native`): verify → upsert (googleId → email link → create) → JWTs + user | ✅ |
| 6 | Remove Appwrite service, OAuth browser flows (`googleLogin`, `oauth/callback`, `oauth/exchange`, `jwtVerify`) | ✅ |
| 7 | Contract tests: fake idToken → **401**, malformed → **400**, both `/v1` and `/api/v1` prefixes OK | ✅ |
| 8 | Follow-up (not in this branch): `POST /v1/auth/refresh` + rotation, then shorten `JWT_EXPIRES_IN` | ⬜ |

---

## 📊 Progress Overview

**Total APIs:** 65  
**Completed:** 0/65  
**In Progress:** 0/65  
**Not Started:** 65/65  

---

## 🔐 Phase 1: Authentication & User Management (Priority: HIGH)

| # | Endpoint | Method | Status | Priority | Notes |
|---|----------|--------|--------|----------|-------|
| 1 | `/api/auth/sync` | POST | ⬜ Not Started | 🔴 Critical | Sync Firebase Auth user to Firestore |
| 2 | `/api/auth/profile` | GET | ⬜ Not Started | 🔴 Critical | Get current user profile |
| 3 | `/api/auth/profile` | PUT | ⬜ Not Started | 🟡 Medium | Update user profile (name, phone, picture) |
| 4 | `/api/auth/profile` | DELETE | ⬜ Not Started | 🟢 Low | Delete user account |
| 5 | `/api/auth/preferences` | GET | ⬜ Not Started | 🟡 Medium | Get user preferences |
| 6 | `/api/auth/preferences` | PUT | ⬜ Not Started | 🟡 Medium | Update user preferences |

**Dependencies:**
- Firebase Admin SDK initialized
- Auth middleware created (`verifyToken`)

---

## 🚨 Phase 2: Emergency SOS Features (Priority: CRITICAL)

| # | Endpoint | Method | Status | Priority | Notes |
|---|----------|--------|--------|----------|-------|
| 7 | `/api/sos/trigger` | POST | ⬜ Not Started | 🔴 Critical | Trigger SOS alert with location |
| 8 | `/api/sos/deactivate/:alertId` | PUT | ⬜ Not Started | 🔴 Critical | Mark SOS as resolved |
| 9 | `/api/sos/active` | GET | ⬜ Not Started | 🔴 Critical | Get user's active SOS alerts |
| 10 | `/api/sos/history` | GET | ⬜ Not Started | 🟡 Medium | Get SOS history with pagination |
| 11 | `/api/sos/:alertId` | GET | ⬜ Not Started | 🟡 Medium | Get specific SOS alert details |
| 12 | `/api/sos/notify-contacts` | POST | ⬜ Not Started | 🔴 Critical | Send SMS/push to emergency contacts |

**Dependencies:**
- Twilio API for SMS (or use FCM only)
- Firebase Cloud Messaging for push notifications
- Realtime Database for live location updates

**Firestore Collections:**
- `sosAlerts` (alertId, userId, location, status, triggeredAt, resolvedAt)

---

## 👥 Phase 3: Emergency Contacts Management (Priority: HIGH)

| # | Endpoint | Method | Status | Priority | Notes |
|---|----------|--------|--------|----------|-------|
| 13 | `/api/contacts` | POST | ⬜ Not Started | 🔴 Critical | Add emergency contact |
| 14 | `/api/contacts` | GET | ⬜ Not Started | 🔴 Critical | Get all emergency contacts |
| 15 | `/api/contacts/:contactId` | GET | ⬜ Not Started | 🟡 Medium | Get specific contact |
| 16 | `/api/contacts/:contactId` | PUT | ⬜ Not Started | 🟡 Medium | Update contact details |
| 17 | `/api/contacts/:contactId` | DELETE | ⬜ Not Started | 🟡 Medium | Remove emergency contact |
| 18 | `/api/contacts/:contactId/guardian` | PUT | ⬜ Not Started | 🟡 Medium | Set/unset as guardian |

**Firestore Collections:**
- `emergencyContacts` (contactId, userId, name, phone, email, relationship, isGuardian)

---

## 📍 Phase 4: Location Tracking & Journey (Priority: HIGH)

| # | Endpoint | Method | Status | Priority | Notes |
|---|----------|--------|--------|----------|-------|
| 19 | `/api/location/share` | POST | ⬜ Not Started | 🔴 Critical | Start sharing live location |
| 20 | `/api/location/stop` | POST | ⬜ Not Started | 🔴 Critical | Stop sharing location |
| 21 | `/api/location/update` | PUT | ⬜ Not Started | 🔴 Critical | Update current location (Realtime DB) |
| 22 | `/api/location/active` | GET | ⬜ Not Started | 🟡 Medium | Get users sharing location with me |
| 23 | `/api/journey/start` | POST | ⬜ Not Started | 🟡 Medium | Start journey tracking |
| 24 | `/api/journey/end/:journeyId` | PUT | ⬜ Not Started | 🟡 Medium | End journey tracking |
| 25 | `/api/journey/checkpoint` | POST | ⬜ Not Started | 🟡 Medium | Add checkpoint to journey |
| 26 | `/api/journey/history` | GET | ⬜ Not Started | 🟢 Low | Get journey history |

**Dependencies:**
- Firebase Realtime Database for live location
- Firestore for journey history

**Realtime Database Structure:**
```json
/activeLocations/{userId}: { latitude, longitude, timestamp, sharingWith: [] }
```

---

## 🏥 Phase 5: Emergency Places (Priority: MEDIUM)

| # | Endpoint | Method | Status | Priority | Notes |
|---|----------|--------|--------|----------|-------|
| 27 | `/api/places/police` | GET | ⬜ Not Started | 🟡 Medium | Get nearby police stations (Google Maps API) |
| 28 | `/api/places/hospital` | GET | ⬜ Not Started | 🟡 Medium | Get nearby hospitals |
| 29 | `/api/places/ambulance` | GET | ⬜ Not Started | 🟡 Medium | Get nearby ambulance services |
| 30 | `/api/places/toilet` | GET | ⬜ Not Started | 🟡 Medium | Get nearby public toilets |
| 31 | `/api/places/save` | POST | ⬜ Not Started | 🟢 Low | Save frequently used place |
| 32 | `/api/places/saved` | GET | ⬜ Not Started | 🟢 Low | Get user's saved places |

**Dependencies:**
- Google Maps Places API (free tier: 28K requests/month)

---

## 📞 Phase 6: Fake Call Feature (Priority: MEDIUM)

| # | Endpoint | Method | Status | Priority | Notes |
|---|----------|--------|--------|----------|-------|
| 33 | `/api/fake-call/schedule` | POST | ⬜ Not Started | 🟡 Medium | Schedule fake call trigger |
| 34 | `/api/fake-call/cancel/:callId` | DELETE | ⬜ Not Started | 🟡 Medium | Cancel scheduled fake call |
| 35 | `/api/fake-call/active` | GET | ⬜ Not Started | 🟡 Medium | Get active fake call schedules |

**Implementation Note:**
- Use cron jobs or scheduled tasks on backend
- Send push notification at scheduled time to trigger call UI in app

---

## 🎙️ Phase 7: Audio Recordings (Priority: MEDIUM)

| # | Endpoint | Method | Status | Priority | Notes |
|---|----------|--------|--------|----------|-------|
| 36 | `/api/recordings/upload` | POST | ⬜ Not Started | 🟡 Medium | Upload recording to Firebase Storage |
| 37 | `/api/recordings` | GET | ⬜ Not Started | 🟡 Medium | Get user's recordings |
| 38 | `/api/recordings/:recordingId` | GET | ⬜ Not Started | 🟡 Medium | Get specific recording metadata |
| 39 | `/api/recordings/:recordingId` | DELETE | ⬜ Not Started | 🟡 Medium | Delete recording |

**Dependencies:**
- Firebase Storage (1 GB free)
- Compress audio before upload

**Firestore Collections:**
- `recordings` (recordingId, userId, fileUrl, duration, fileSize, recordedAt)

---

## 📱 Phase 8: Community Feed (Priority: MEDIUM)

| # | Endpoint | Method | Status | Priority | Notes |
|---|----------|--------|--------|----------|-------|
| 40 | `/api/posts` | POST | ⬜ Not Started | 🟡 Medium | Create new post |
| 41 | `/api/posts` | GET | ⬜ Not Started | 🟡 Medium | Get community feed (pagination) |
| 42 | `/api/posts/:postId` | GET | ⬜ Not Started | 🟡 Medium | Get specific post |
| 43 | `/api/posts/:postId` | PUT | ⬜ Not Started | 🟡 Medium | Update post (own posts only) |
| 44 | `/api/posts/:postId` | DELETE | ⬜ Not Started | 🟡 Medium | Delete post (own posts only) |
| 45 | `/api/posts/user/:userId` | GET | ⬜ Not Started | 🟡 Medium | Get posts by specific user |
| 46 | `/api/posts/:postId/like` | POST | ⬜ Not Started | 🟢 Low | Like/unlike post |
| 47 | `/api/posts/:postId/share` | POST | ⬜ Not Started | 🟢 Low | Share post |

**Firestore Collections:**
- `posts` (postId, userId, content, mediaUrls, hashtags, likesCount, commentsCount, createdAt)

---

## 💬 Phase 9: Comments System (Priority: LOW)

| # | Endpoint | Method | Status | Priority | Notes |
|---|----------|--------|--------|----------|-------|
| 48 | `/api/posts/:postId/comments` | POST | ⬜ Not Started | 🟢 Low | Add comment to post |
| 49 | `/api/posts/:postId/comments` | GET | ⬜ Not Started | 🟢 Low | Get comments for post |
| 50 | `/api/comments/:commentId` | PUT | ⬜ Not Started | 🟢 Low | Update comment |
| 51 | `/api/comments/:commentId` | DELETE | ⬜ Not Started | 🟢 Low | Delete comment |

**Firestore Collections:**
- `comments` (commentId, postId, userId, content, createdAt)

---

## 🤖 Phase 10: SHEild AI Assistant (Priority: MEDIUM)

| # | Endpoint | Method | Status | Priority | Notes |
|---|----------|--------|--------|----------|-------|
| 52 | `/api/ai/chat` | POST | ⬜ Not Started | 🟡 Medium | Send message to AI (OpenAI API) |
| 53 | `/api/ai/history` | GET | ⬜ Not Started | 🟢 Low | Get chat history |
| 54 | `/api/ai/clear-history` | DELETE | ⬜ Not Started | 🟢 Low | Clear chat history |
| 55 | `/api/ai/preset-questions` | GET | ⬜ Not Started | 🟡 Medium | Get preset safety questions |

**Dependencies:**
- OpenAI API (GPT-3.5: ~$0.002/request)
- Preset responses for common safety questions

---

## 🔔 Phase 11: Notifications (Priority: MEDIUM)

| # | Endpoint | Method | Status | Priority | Notes |
|---|----------|--------|--------|----------|-------|
| 56 | `/api/notifications` | GET | ⬜ Not Started | 🟡 Medium | Get user notifications |
| 57 | `/api/notifications/:notificationId/read` | PUT | ⬜ Not Started | 🟡 Medium | Mark notification as read |
| 58 | `/api/notifications/read-all` | PUT | ⬜ Not Started | 🟢 Low | Mark all as read |
| 59 | `/api/notifications/settings` | GET | ⬜ Not Started | 🟢 Low | Get notification preferences |
| 60 | `/api/notifications/settings` | PUT | ⬜ Not Started | 🟢 Low | Update notification preferences |

**Dependencies:**
- Firebase Cloud Messaging (FCM) - unlimited on free tier

**Firestore Collections:**
- `notifications` (notificationId, userId, type, title, body, read, createdAt)

---

## 📊 Phase 12: Analytics & Reports (Priority: LOW)

| # | Endpoint | Method | Status | Priority | Notes |
|---|----------|--------|--------|----------|-------|
| 61 | `/api/analytics/sos-stats` | GET | ⬜ Not Started | 🟢 Low | Get SOS usage statistics |
| 62 | `/api/analytics/user-activity` | GET | ⬜ Not Started | 🟢 Low | Get user activity stats |
| 63 | `/api/analytics/community-stats` | GET | ⬜ Not Started | 🟢 Low | Get community engagement stats |

---

## ⚙️ Phase 13: Utilities & Admin (Priority: LOW)

| # | Endpoint | Method | Status | Priority | Notes |
|---|----------|--------|--------|----------|-------|
| 64 | `/api/health` | GET | ⬜ Not Started | 🟡 Medium | Health check endpoint |
| 65 | `/api/version` | GET | ⬜ Not Started | 🟢 Low | Get API version info |

---

## 📦 Required NPM Packages

### Core
- ✅ `express` - Web framework
- ✅ `firebase-admin` - Firebase Admin SDK
- ✅ `cors` - Cross-origin requests
- ✅ `dotenv` - Environment variables

### External Services
- ⬜ `twilio` - SMS notifications (optional)
- ⬜ `openai` - AI assistant
- ⬜ `@google/maps` - Google Maps API client

### Utilities
- ⬜ `node-cron` - Scheduled tasks (fake call)
- ⬜ `multer` - File upload handling
- ⬜ `helmet` - Security headers
- ⬜ `express-rate-limit` - Rate limiting

---

## 🏗️ Project Structure

```
sheild-backend/
├── config/
│   ├── firebase.js          # Firebase Admin initialization
│   └── env.js               # Environment config
├── middleware/
│   ├── auth.js              # Token verification
│   ├── errorHandler.js      # Global error handling
│   └── rateLimiter.js       # API rate limiting
├── routes/
│   ├── auth.routes.js       # Authentication routes
│   ├── sos.routes.js        # SOS routes
│   ├── contacts.routes.js   # Emergency contacts
│   ├── location.routes.js   # Location tracking
│   ├── places.routes.js     # Emergency places
│   ├── posts.routes.js      # Community feed
│   ├── ai.routes.js         # AI assistant
│   └── notifications.routes.js
├── services/
│   ├── sms.service.js       # SMS handling (Twilio)
│   ├── fcm.service.js       # Push notifications
│   ├── maps.service.js      # Google Maps API
│   └── openai.service.js    # AI assistant
├── utils/
│   ├── validators.js        # Input validation
│   └── helpers.js           # Helper functions
├── .env
├── .gitignore
├── package.json
└── server.js                # Entry point
```

---

## 🔒 Security Checklist

- [ ] Firebase Admin SDK service account key secured (not in repo)
- [ ] Environment variables for all API keys
- [ ] HTTPS only in production
- [ ] Rate limiting on all endpoints
- [ ] Input validation and sanitization
- [ ] CORS configured properly
- [ ] Helmet security headers
- [ ] Firebase security rules for Firestore/Storage

---

## 📝 Environment Variables Required

```env
# Firebase
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=

# Twilio (optional)
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=

# OpenAI
OPENAI_API_KEY=

# Google Maps
GOOGLE_MAPS_API_KEY=

# Server
PORT=3000
NODE_ENV=development
```

---

## 🚀 Development Phases Priority

### MVP (Minimum Viable Product)
1. ✅ Authentication & User Management (Phase 1)
2. ✅ Emergency SOS Features (Phase 2)
3. ✅ Emergency Contacts Management (Phase 3)
4. ✅ Location Tracking (Phase 4)

### Version 1.0
5. Emergency Places (Phase 5)
6. Fake Call Feature (Phase 6)
7. Community Feed (Phase 8)
8. Notifications (Phase 11)

### Version 2.0
9. Audio Recordings (Phase 7)
10. SHEild AI Assistant (Phase 10)
11. Comments System (Phase 9)
12. Analytics (Phase 12)

---

## 📊 Status Legend

- ⬜ Not Started
- 🟦 In Progress
- ✅ Completed
- ⚠️ Blocked
- 🔴 Critical Priority
- 🟡 Medium Priority
- 🟢 Low Priority

---

## 📅 Estimated Timeline

- **MVP (Phase 1-4):** 2-3 weeks
- **Version 1.0 (Phase 5-8, 11):** 2-3 weeks
- **Version 2.0 (Phase 7, 9-10, 12):** 3-4 weeks

**Total Development Time:** 7-10 weeks (for full-time development)

---

## 💡 Notes

- Start with Firebase free tier (Spark Plan)
- Monitor daily Firestore read/write limits (50K reads, 20K writes)
- Implement caching to reduce database calls
- Use Cloud Functions (requires Blaze Plan) OR external server (Render free tier)
- Test with 100-500 users before scaling

---

**Last Updated:** November 21, 2025  
**Developer:** Mainak  
**Project:** SHEild Women's Safety App