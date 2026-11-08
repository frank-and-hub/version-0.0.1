# Scalable Full-Stack Monorepo Architecture

A production-ready full-stack monorepo featuring **Next.js 15+ (App Router)**, **NestJS 10+ REST API**, **PostgreSQL (Prisma ORM)**, **MongoDB (Mongoose ODM)**, and **Valkey (Redis-compatible In-Memory Cache)** with a comprehensive **Role-Based Admin Panel**, **Database-Driven Dynamic Sidebar**, and **Dedicated User Portal**.

---

## 🏗️ Architecture Overview

```mermaid
flowchart TD
    subgraph Client ["Frontend Tier (Next.js 15 & React Native)"]
        AdminUI["Admin Panel (/admin/*)<br/>• Dynamic DB Sidebar<br/>• 12 Admin Modules<br/>• Server-Side DataTables"]
        UserUI["Member Portal (/dashboard/*)<br/>• Personal Overview<br/>• Activity Feed<br/>• Profile & Security"]
        AuthUI["Auth Gateway (/login & /register)<br/>• Auto Role Redirection<br/>• Social Auth Framework"]
        MobileApp["Mobile App (Expo 52 / React Native 0.76)<br/>• iOS & Android Client<br/>• Unified UI & Shared Tokens"]
    end

    subgraph Gateway ["Backend Tier (NestJS 10 REST API)"]
        NestCore["NestJS API (/api) + Swagger (/docs)<br/>• Global x-correlation-id Middleware<br/>• PermissionsGuard & RolesGuard<br/>• Super Admin Bypass Logic<br/>• Transform & Redaction Interceptors<br/>• Distributed Rate Limiting"]
    end

    subgraph DataTier ["Multi-Model Storage Tier"]
        PG[("PostgreSQL 16 (Port 5433)<br/>Prisma ORM • UUID Primary Keys<br/>• users, roles, permissions<br/>• menu_items (nested sidebar tree)<br/>• audit_logs (structured diffs)<br/>• user_activity_logs, settings")]
        Mongo[("MongoDB 7 (Port 27018)<br/>Mongoose ODM<br/>• application_error_logs<br/>• Uncaught exceptions & stack traces<br/>• HTTP request context")]
        Valkey[("Valkey / Redis 8 (Port 6379)<br/>ioredis<br/>• Instant JWT Blacklisting<br/>• Sliding Window Rate Limiting<br/>• Active session invalidation")]
    end

    Client -->|REST API + Bearer JWT + Cookies| Gateway
    Gateway -->|ACID Transactions & Foreign Keys| PG
    Gateway -->|Semi-Structured Error Documents| Mongo
    Gateway -->|Sub-millisecond Key-Value Ops| Valkey
```

---

## 📁 Monorepo Structure

```text
version-0.0.1/
├── apps/
│   ├── web/                         # Next.js 15+ App Router web application
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   ├── admin/           # Admin Panel (Role Guarded: SUPER_ADMIN, ADMIN, MODERATOR)
│   │   │   │   │   ├── dashboard/   # Module 1: System overview & metrics
│   │   │   │   │   ├── messaging/   # Multi-Provider Messaging Platform (Email, WhatsApp, Twilio SMS)
│   │   │   │   │   ├── roles/       # Module 2: Roles & permissions management
│   │   │   │   │   ├── users/       # Module 3: Full user management data table
│   │   │   │   │   ├── moderators/  # Module 4: Moderator management
│   │   │   │   │   ├── navigation/  # Module 5: Dynamic sidebar hierarchy manager
│   │   │   │   │   ├── audit-logs/  # Module 6: PostgreSQL structured audit logs & diffs
│   │   │   │   │   ├── activity-logs/# Module 7: User activity tracking
│   │   │   │   │   ├── error-logs/  # Module 8: MongoDB exception logs & stack traces
│   │   │   │   │   ├── settings/    # Module 9: System default settings editor
│   │   │   │   │   ├── profile/     # Module 10: Admin profile & password change
│   │   │   │   │   ├── health/      # Module 11: Real-time service health benchmarks
│   │   │   │   │   ├── knowledge-graph/ # Module 12: Knowledge graph AST explorer
│   │   │   │   │   └── layout.tsx   # Admin layout with dynamic DB sidebar
│   │   │   │   ├── dashboard/       # Standard User Portal (Isolated from Admin)
│   │   │   │   │   ├── profile/     # User profile & verified password change
│   │   │   │   │   ├── layout.tsx   # User portal navigation layout
│   │   │   │   │   └── page.tsx     # User welcome, summary & personal activities
│   │   │   │   ├── (auth)/          # Authentication pages (login, register)
│   │   │   │   ├── layout.tsx       # Root layout with AuthProvider
│   │   │   │   └── page.tsx         # Smart root redirect based on user role
│   │   │   ├── components/
│   │   │   │   ├── data-table/      # Reusable generic DataTable component
│   │   │   │   ├── layout/          # AdminSidebar, AdminTopbar
│   │   │   │   ├── ui/              # Reusable Button, Modal, Badge, Card, Breadcrumbs, Input, etc.
│   │   │   │   └── users/           # UserFormModal, DeleteUserModal
│   │   │   ├── context/             # AuthContext (Role redirection & session management)
│   │   │   └── lib/                 # ApiClient with automatic token refresh
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── mobile/                      # React Native 0.76+ & Expo 52+ Cross-Platform Mobile App
│   │   ├── src/
│   │   │   ├── screens/             # Login, Register, UserDashboard, AdminDashboard, Users, Roles, Logs, Health, Graph
│   │   │   ├── components/          # Native Badge, Button, Input, Card, HostSettingsModal
│   │   │   ├── context/             # Mobile AuthContext & ThemeContext
│   │   │   └── lib/                 # Mobile ApiClient (Expo SecureStore + Bearer tokens + 10.0.2.2/LAN resolver)
│   │   ├── metro.config.js          # Monorepo pnpm symlink & package resolver
│   │   ├── app.json                 # Expo configuration (com.monorepo.mobile)
│   │   ├── eas.json                 # Android APK preview & production builds
│   │   └── package.json
│   │
│   └── api/                         # NestJS 10+ REST API backend
│       ├── src/
│       │   ├── auth/                # JWT Auth, Argon2id/Bcrypt hashing, refresh tokens, guards
│       │   ├── users/               # User management, profile endpoints, metrics
│       │   ├── roles/               # Role & permission matrix endpoints
│       │   ├── navigation/          # Dynamic DB menu tree & circular reference detection
│       │   ├── audit/               # PostgreSQL structured audit logs & MongoDB error logs
│       │   ├── activity/            # User activity log tracking & personal feed
│       │   ├── settings/            # Default settings management
│       │   ├── cache/               # Valkey cache service & distributed rate limiter
│       │   ├── health/              # Multi-tier health probe (PG, Mongo, Valkey)
│       │   ├── common/              # Correlation ID middleware, HttpExceptionFilter, interceptors
│       │   ├── database/            # PrismaService
│       │   ├── app.module.ts
│       │   └── main.ts
│       ├── prisma/
│       │   ├── schema.prisma        # UUID-based relational schema
│       │   └── seed.ts              # Database seeder with roles, menus, settings, & users
│       ├── package.json
│       └── tsconfig.json
│
├── packages/
│   ├── shared-types/                # TypeScript interfaces, enums, DTOs, and contracts
│   ├── shared-utils/                # Menu tree builders, circular checks, redaction, pagination
│   ├── ui/                          # Shared component contracts and design tokens (Button, Badge, Input, Card)
│   ├── validation/                  # Zod validation schemas
│   └── config/                      # Base TypeScript & configuration packages
│
├── docker-compose.yml               # PostgreSQL (5433), MongoDB (27018), and Valkey (6379)
├── pnpm-workspace.yaml              # pnpm workspace definition
├── package.json                     # Monorepo scripts (dev, build, test, db:seed)
├── tsconfig.base.json
└── README.md
```

---

## 🔐 Role-Based Access Control & Privilege Hierarchy

The system supports 4 distinct roles with strict privilege hierarchy:

```
SUPER_ADMIN (Bypasses individual permissions; Full control)
   └── ADMIN (Explicitly granted administrative permissions)
        └── MODERATOR (Explicitly granted moderation permissions)
             └── USER (Isolated to personal member endpoints)
```

### Granular Permission Matrix (12 Standard Permissions)
- `users.read`: View users and user profiles
- `users.create`: Provision new accounts
- `users.update`: Modify existing user attributes and statuses
- `users.delete`: Delete user accounts
- `users.view_activity`: Inspect audit histories and user activity logs
- `roles.manage`: Create, edit, and assign roles
- `permissions.manage`: Assign permissions to roles
- `navigation.manage`: Manage database-driven navigation items
- `audit_logs.read`: Access PostgreSQL structured audit logs
- `error_logs.read`: Inspect MongoDB application error traces
- `settings.manage`: Modify default system settings
- `moderators.manage`: Provision and manage moderator privileges

---

## 🗄️ Polyglot Database Storage Strategy

| Storage Engine | Technology | Port | Role in System | What Is Stored Here |
| :--- | :--- | :--- | :--- | :--- |
| **Relational Database** | **PostgreSQL 16** (Prisma ORM) | `5433` | Primary ACID Store | `users`, `roles`, `permissions`, `menu_items`, `audit_logs`, `user_activity_logs`, `settings`, `refresh_tokens`. |
| **Document Database** | **MongoDB 7** (Mongoose ODM) | `27018` | Unstructured Telemetry | `application_error_logs` (captures uncaught exceptions, stack traces, and dynamic HTTP request payloads). |
| **In-Memory Cache** | **Valkey 8** (ioredis) | `6379` | Ephemeral Speed Tier | Revoked JWT blacklist, sliding window rate-limiting counters, and session state. |

---

## 🔑 Default Seed Credentials

All test accounts are seeded with pre-configured roles:

| Role | Email | Password | Access Target |
| :--- | :--- | :--- | :--- |
| **SUPER_ADMIN** | `superadmin@example.com` | `SuperAdmin123!` | `/admin/dashboard` (Full system bypass) |
| **ADMIN** | `admin@example.com` | `Admin123!` | `/admin/dashboard` (Granted permissions) |
| **MODERATOR** | `moderator@example.com` | `User123!` | `/admin/dashboard` (Moderation subset) |
| **USER** | `user@example.com` | `User123!` | `/dashboard` (Member Portal) |

> [!NOTE]
> The login interface contains no role dropdown; destination routing is determined dynamically by the backend following authentication.

---

## 🚀 Complete Step-by-Step Setup & Startup Guide

Follow these instructions to start the entire project from scratch.

### 1. Prerequisites & Required Dependencies

Ensure you have the following installed on your machine:
- **Node.js**: `>= 20.x` (Recommended: v20 LTS or v22 LTS)
- **pnpm**: `>= 9.x` (Install globally via `npm install -g pnpm`)
- **Docker & Docker Compose**: Docker Engine v24+ with Compose v2+
- **Python**: `>= 3.11` (Optional: required for AST Graphify updates)
- **Git**

Verify your local versions:
```bash
node -v
pnpm -v
docker compose version
```

---

### 2. Installation & Workspace Setup

Clone the repository and install all workspace dependencies across all applications and shared packages:

```bash
# 1. Clone repository
git clone https://github.com/frank-and-hub/version-0.0.1.git
cd version-0.0.1

# 2. Install monorepo dependencies
pnpm install
```

---

### 3. Environment Variable Configuration

Create your root `.env` file from the provided `.env.example`:

```bash
cp .env.example .env
```

Review or customize `.env` (default configured ports match Docker Compose):

```ini
# Environment Mode
NODE_ENV=development

# Frontend Configuration
WEB_PORT=3000
NEXT_PUBLIC_API_URL=http://localhost:4000/api

# Backend Configuration
API_PORT=4000
API_GLOBAL_PREFIX=api
CORS_ORIGIN=http://localhost:3000

# PostgreSQL (Relational Data: Port 5433 mapped to container 5432)
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=monorepo_db
POSTGRES_PORT=5433
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/monorepo_db?schema=public

# MongoDB (Document Logs: Port 27018 mapped to container 27017)
MONGO_INITDB_ROOT_USERNAME=root
MONGO_INITDB_ROOT_PASSWORD=password
MONGO_INITDB_DATABASE=monorepo_db
MONGO_PORT=27018
MONGODB_URI=mongodb://root:password@localhost:27018/monorepo_db?authSource=admin

# Valkey / Redis (Port 6379)
VALKEY_PORT=6379
VALKEY_HOST=localhost
VALKEY_PASSWORD=

# JWT Authentication Secrets (Generate with: openssl rand -base64 32)
JWT_ACCESS_SECRET=your_jwt_access_secret_super_secure_key_12345
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_SECRET=your_jwt_refresh_secret_super_secure_key_67890
JWT_REFRESH_EXPIRES_IN=7d
```

---

### 4. Docker Compose Commands

Start the database services in the background:

```bash
# Start all 3 database services (PostgreSQL, MongoDB, Valkey)
docker compose up -d

# Verify containers are healthy and running
docker compose ps
```

To stop or reset database services:
```bash
# Stop containers
docker compose down

# Stop containers and erase data volumes (clean slate)
docker compose down -v
```

---

### 5. Database Setup, Migrations & Seeding

Sync the database schema and populate all seed accounts, roles, permissions, dynamic menus, and system settings:

```bash
# 1. Build all shared packages (@monorepo/shared-types, @monorepo/ui, etc.)
pnpm --filter "./packages/*" build

# 2. Generate Prisma Client
pnpm --filter api prisma:generate

# 3. Push schema to PostgreSQL
pnpm --filter api db:push

# 4. Seed initial database records
pnpm --filter api db:seed
```

---

### 6. Development Startup Commands

#### Option A: Start All Services Together (Recommended)
Runs the NestJS backend and Next.js frontend concurrently in a single terminal with colored logs:

```bash
pnpm dev
```

#### Option B: Start Services Individually in Separate Terminals
```bash
# Terminal 1: Backend API (NestJS watch mode on Port 4000)
pnpm dev:api

# Terminal 2: Web Frontend (Next.js dev server on Port 3000)
pnpm dev:web

# Terminal 3: Mobile App (Expo Metro bundler)
pnpm mobile
```

Once running, access the services:
- **Web Frontend:** [http://localhost:3000](http://localhost:3000)
- **NestJS REST API:** [http://localhost:4000/api](http://localhost:4000/api)
- **Interactive Swagger Documentation:** [http://localhost:4000/docs](http://localhost:4000/docs)
- **Service Health Check:** [http://localhost:4000/api/health](http://localhost:4000/api/health)

---

### 7. Production Build & Startup Commands

To build and run the applications in production mode:

```bash
# 1. Build all packages and applications (Next.js + NestJS)
pnpm build

# 2. Start NestJS Backend in production mode
pnpm --filter api start:prod

# 3. Start Next.js Frontend in production mode
pnpm --filter web start
```

---

### 8. Testing

Run all unit and integration test suites:

```bash
pnpm test
```

---

### 9. Mobile Application Commands (`apps/mobile`)

```bash
# Start Expo Metro development server
pnpm mobile

# Launch on connected Android device / emulator
pnpm mobile:android

# Launch on iOS simulator (macOS required)
pnpm mobile:ios

# Run mobile layout in desktop browser
pnpm mobile:web

# Prebuild native code and compile standalone Android release APK
pnpm mobile:build:apk
```

---

### 10. Troubleshooting Common Issues

#### Issue 1: Port Conflict (Port 5433, 27018, or 6379 already in use)
* **Symptom:** Docker container fails to bind to port.
* **Fix:** Check running ports with `sudo lsof -i :<port>` or `docker ps`. Stop conflicting local PostgreSQL/MongoDB services or adjust the port mapping in `docker-compose.yml` and `.env`.

#### Issue 2: `PrismaClientInitializationError: Can't reach database server`
* **Symptom:** API fails to start with database connection error.
* **Fix:** Verify Docker containers are running with `docker compose ps`. Test PostgreSQL connectivity via `nc -zv localhost 5433`. Run `pnpm --filter api prisma:generate` to refresh client bindings.

#### Issue 3: pnpm store or lockfile mismatch error (`ERR_PNPM_UNEXPECTED_STORE`)
* **Symptom:** `pnpm install` or `pnpm build` displays store warning.
* **Fix:** Run a clean install:
  ```bash
  rm -rf node_modules apps/*/node_modules packages/*/node_modules
  pnpm install
  ```

#### Issue 4: Next.js SSR Hydration Error on Input components
* **Symptom:** Console warning about `htmlFor` / `id` attribute mismatch.
* **Fix:** Ensure dynamic IDs use `React.useId()` instead of `Math.random()` or time-based keys. This has been resolved in `@monorepo/ui` and `apps/web/src/components/ui/Input.tsx`.

#### Issue 5: Expo Prebuild / Metro Build Error in Mobile
* **Symptom:** `Error: Unable to resolve module @babel/runtime/helpers/...`
* **Fix:** Ensure `babel-preset-expo: ~12.0.12` and `@babel/runtime: ^7.25.0` are present in `apps/mobile/package.json` and `apps/mobile/babel.config.js` exists. Both are pre-configured.

---

### 11. Multi-Provider Messaging Platform (Phases 1, 2, 3 & 4: Email, WhatsApp & Twilio SMS)

The platform provides a scalable, enterprise multi-tenant messaging router with credential encryption, dynamic configuration schemas, templating engine, Valkey background queues, cryptographic webhook verification, real-time delivery telemetry, official Meta WhatsApp Business Cloud API integration, and official Twilio Programmable SMS with automated TCPA/CTIA compliance.

#### Architecture Highlights
1. **Global Provider Registry (`providers` table):**
   - Seeded with 23 multi-channel providers across Email (8 providers), WhatsApp (8 providers), and SMS (7 providers).
   - Fully operational adapters for **Email** (SMTP, SendGrid, Amazon SES, Mailgun, Mandrill, Brevo, Postmark, Resend), **WhatsApp** (Meta Cloud API, Interakt, WATI, Twilio, Infobip, Gupshup, Vonage, AISensy), and **SMS** (**Twilio**, **AWS SNS**, **MessageBird**, **Vonage**, **Plivo**, **Telnyx**, and **Infobip**).
2. **Multi-Tenant Encrypted Credentials (`user_provider_configurations` table):**
   - AES-256-GCM symmetric encryption with randomized 16-byte initialization vectors and auth tags.
   - Plaintext credentials and secrets (API keys, Meta Access Tokens, Twilio Auth Tokens, App Secrets) are stripped and masked before serialization to API responses.
   - Per-user configuration isolation with default provider selection.
3. **Template Engine & Variable Mapping:**
   - Transactional email templates with dynamic `{{variable}}` token extraction and handlebar interpolation for subjects and HTML bodies.
   - WhatsApp message templates with component parameter mapping, category tracking (MARKETING, UTILITY, AUTHENTICATION), and direct synchronization from Meta Graph API.
   - SMS message templates with live variable extraction, preview chips, and segment calculation.
4. **Valkey Background Queue & Exponential Backoff (`EmailQueueService` & `EmailWorkerService`):**
   - High-throughput asynchronous dispatching via Valkey atomic `LPUSH` / `RPOPLPUSH`.
   - Automatic retry handling with dead-letter queue (DLQ) support.
5. **Phase 2: Email Webhooks, Delivery Tracking & Event Deduplication (`MessagingWebhooksModule`):**
   - **Dynamic Webhook Endpoints:** Dedicated endpoints generated per provider configuration (`/api/webhooks/messaging/email/{configuration-uuid}`).
   - **SendGrid Signed Event Webhooks:** Cryptographic ECDSA SHA-256 signature verification (`X-Twilio-Email-Event-Webhook-Signature` & `X-Twilio-Email-Event-Webhook-Timestamp`).
   - **Event Normalization & Deduplication:** Normalizes incoming provider batches into standard types (`DELIVERED`, `OPENED`, `CLICKED`, `BOUNCED`, `DROPPED`, `SPAM_REPORTED`, `UNSUBSCRIBED`, `FAILED`) with 24-hour Valkey atomic deduplication.
   - **Message Status Management:** Recipient-level isolation and message lifecycle updates without regressing terminal states.
   - **Engagement & Telemetry Analytics:** Dedicated message details timeline modal (inspecting exact event sequences, clicked URLs, and bounce causes) and aggregated 7-day time series charts.
6. **Phase 3: Meta WhatsApp Business Platform (Cloud API):**
   - **Official Cloud API Integration (`WhatsAppCloudApiAdapter`):** Direct communication with Meta Graph API `v21.0` using Phone Number ID and System User Permanent Access Tokens.
   - **E.164 Phone Normalization:** Automatic formatting and validation of international destination numbers.
   - **24-Hour Customer Service Session Window Enforcement:** Strict adherence to Meta policies. Direct free-form text and media messages are permitted only within an open 24-hour window from the user's last inbound message. When closed, approved Template Messages are required to re-initiate contact.
   - **Cryptographic Webhook Handshake & Security:**
     - `GET /api/webhooks/messaging/whatsapp/:configurationUuid`: Verifies `hub.mode === 'subscribe'` and `hub.verify_token`, responding with plain text `hub.challenge`.
     - `POST /api/webhooks/messaging/whatsapp/:configurationUuid`: Cryptographic HMAC-SHA256 signature verification (`X-Hub-Signature-256`) against decrypted Meta App Secret.
   - **Two-Way Real-Time Chat & Threading (`WhatsAppMessagingTab`):** Complete customer inbox with chronological chat history, delivery receipts (`sent`, `delivered`, `read`, `failed`), and dynamic template variable composer.
7. **Phase 4: Multi-Provider SMS Platform (Twilio, AWS SNS, MessageBird, Vonage, Plivo, Telnyx & Infobip):**
   - **Multi-Provider SMS Routing:** Seamlessly connect and route dispatches through 7 enterprise SMS gateways:
     - **Twilio Programmable Messaging:** Full carrier routing, Status Callbacks, and Inbound messaging.
     - **Amazon Web Services (AWS SNS):** High-scale transactional and promotional SMS with region selection and IAM credentials.
     - **MessageBird (Bird):** Tier-1 direct carrier connection across 240+ global networks.
     - **Vonage SMS (Nexmo):** Adaptive routing SMS with real-time delivery receipts.
     - **Plivo SMS:** Carrier connectivity with localized number pooling and high throughput.
     - **Telnyx SMS:** Mission-critical private IP network with 10DLC support.
     - **Infobip SMS:** Enterprise omnichannel communications platform.
   - **Character & Segment Counter:** Live computation distinguishing **GSM 7-bit** (160 single / 153 concatenated) and **UCS-2 Unicode** (70 single / 67 concatenated), providing character counts, segments, remaining chars, and encoding warnings.
   - **Scheduled SMS Dispatch:** Schedule messages for future dates/times with real-time pre-dispatch cancellation (`POST /api/messaging/sms/:uuid/cancel`).
   - **Controlled Bulk SMS Dispatch:** Bulk dispatch with deduplication, opt-out validation, and recipient tracking.
   - **TCPA / CTIA Opt-Out & Suppression List:**
     - Automatically intercepts incoming keywords (`STOP`, `UNSUBSCRIBE`, `CANCEL`, `QUIT`, `END`) to add the recipient to the `sms_opt_outs` database suppression list.
     - Automatically removes recipient on opt-in keywords (`START`, `YES`, `UNSTOP`).
     - Rejects any dispatch attempt to opted-out recipients prior to contacting provider APIs.
     - Manual opt-out addition and removal UI in the Admin Panel.
   - **Cryptographic Webhook Verification:** Twilio HMAC-SHA1 signature verification (`X-Twilio-Signature`) over full URL and sorted parameters.
   - **Two-Way Conversations:** Automatically groups inbound and outbound messages into threaded conversations (`sms_conversations` table) with real-time reply composer.

#### Webhook Setup Instructions

##### SendGrid Email Webhooks
1. In your SendGrid Dashboard, navigate to **Settings → Mail Settings → Event Webhook**.
2. Copy your unique dynamic webhook URL from `/admin/messaging` (**Webhooks & Events** tab).
3. Paste the URL into SendGrid's **HTTP Post URL** field.
4. Enable **Signed Event Webhook** and copy the **Verification Key**.
5. Paste the verification key into the dashboard to verify incoming signatures cryptographically.

##### Meta WhatsApp Webhooks
1. In the **Meta App Dashboard**, navigate to **WhatsApp → Configuration → Webhook**.
2. In the **Callback URL** field, paste your generated endpoint URL: `https://your-domain.com/api/webhooks/messaging/whatsapp/<configuration-uuid>`.
3. In the **Verify Token** field, paste your configured Webhook Verify Token.
4. Under **Webhook fields**, click **Manage** and subscribe to `messages`.
5. Incoming replies, status deliveries (`sent`, `delivered`, `read`), and failure reasons will be verified via HMAC-SHA256 and reflected in real-time.

##### Twilio SMS Webhooks
1. In the **Twilio Console**, navigate to **Phone Numbers → Manage → Active Numbers** (or your **Messaging Service**).
2. Under **A CALL COMES IN / A MESSAGE COMES IN**, set **A Message Comes In** to **Webhook (HTTP POST)**.
3. In the URL field, paste your generated Inbound Webhook URL:
   `https://your-domain.com/api/webhooks/messaging/sms/twilio/<configuration-uuid>/inbound`
4. Under **Status Callback URL**, paste your generated Status Callback URL:
   `https://your-domain.com/api/webhooks/messaging/sms/twilio/<configuration-uuid>/status`
5. Save changes. Twilio delivery receipts (`sent`, `delivered`, `undelivered`, `failed`) and inbound customer replies/opt-outs will now process automatically with HMAC-SHA1 verification.

#### API Endpoints (Messaging, Webhooks, WhatsApp & SMS)
* `POST /api/webhooks/messaging/email/:configurationUuid`: Public webhook receiver for SendGrid/email providers.
* `GET /api/webhooks/messaging/whatsapp/:configurationUuid`: Public Meta webhook verification handshake (`hub.challenge`).
* `POST /api/webhooks/messaging/whatsapp/:configurationUuid`: Public Meta webhook event receiver (HMAC-SHA256 verified).
* `POST /api/webhooks/messaging/sms/twilio/:configurationUuid/status`: Public Twilio status callback webhook receiver (HMAC-SHA1 verified).
* `POST /api/webhooks/messaging/sms/twilio/:configurationUuid/inbound`: Public Twilio inbound SMS webhook receiver (TCPA opt-out auto-detection).
* `POST /api/messaging/sms/send`: Send or schedule a single SMS message.
* `POST /api/messaging/sms/bulk`: Dispatch controlled bulk SMS messages.
* `POST /api/messaging/sms/:uuid/cancel`: Cancel a scheduled SMS message before dispatch.
* `POST /api/messaging/sms/calculate-segments`: Calculate character count and segments preview.
* `GET /api/messaging/sms`: Get SMS message history with pagination and status filters.
* `GET /api/messaging/sms/stats`: Get aggregated SMS delivery statistics.
* `GET /api/messaging/sms/conversations`: List two-way SMS conversation threads.
* `GET /api/messaging/sms/conversations/:uuid/messages`: Get messages in an SMS conversation thread.
* `GET /api/messaging/sms/opt-outs`: Get opted-out suppression phone numbers.
* `POST /api/messaging/sms/opt-outs`: Manually add phone number to opt-out list.
* `DELETE /api/messaging/sms/opt-outs/:phone`: Remove phone number from opt-out list (re-opt-in).
* `GET /api/messaging/sms/templates`: List saved SMS templates.
* `POST /api/messaging/sms/templates`: Create an SMS template with variable extraction.
* `PATCH /api/messaging/sms/templates/:uuid`: Update an SMS template.
* `DELETE /api/messaging/sms/templates/:uuid`: Delete an SMS template.
* `GET /api/messaging/whatsapp/conversations`: List customer WhatsApp conversations with 24-hr session status.
* `GET /api/messaging/whatsapp/conversations/:conversationUuid/messages`: Chronological conversation message history.
* `POST /api/messaging/whatsapp/messages/send`: Send outbound WhatsApp message (Session text/media or Template).
* `GET /api/messaging/whatsapp/session-check`: Validate 24-hour customer service window for a contact.
* `GET /api/messaging/whatsapp/templates`: List synced message templates.
* `POST /api/messaging/whatsapp/templates/sync/:configurationUuid`: Sync templates from Meta Graph API.
* `GET /api/messaging/webhook-endpoints/:configurationUuid`: Retrieve or generate unique endpoint URL and setup guide.
* `PUT /api/messaging/webhook-endpoints/:configurationUuid/secret`: Save verification public key / signing secret.
* `PUT /api/messaging/webhook-endpoints/:configurationUuid/status`: Enable or disable a webhook endpoint.
* `GET /api/messaging/webhook-events`: Paginated list of ingested, deduplicated webhook events.
* `POST /api/messaging/webhook-events/:eventUuid/retry`: Re-process a failed webhook event.
* `GET /api/messaging/emails/:messageUuid/details`: Comprehensive message telemetry, recipient outcomes, and event timeline.
* `GET /api/messaging/analytics`: Aggregated open/click/bounce rates and 7-day volume time series.


