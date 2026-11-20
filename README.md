# ReachInbox – Full-Stack Email Job Scheduler

A distributed, production-grade email job scheduler designed for high-concurrency outbound email campaigns. Built with **BullMQ**, **Redis**, **PostgreSQL (Prisma ORM)**, **Elasticsearch**, **Nodemailer (Ethereal SMTP)**, **Slack OAuth 2.0**, and a **React 18 + Vite + Tailwind CSS** dashboard.

---

## 1. Project Overview

ReachInbox Email Job Scheduler solves the problem of scheduling and delivering high-volume outbound email campaigns with fine-grained rate limiting, inter-email throttling, and fault-tolerant persistent queue workers.

### Key Capabilities:
- **Persistent BullMQ Queues**: Redis-backed delayed jobs that survive server restarts.
- **Restart Recovery & Reconciliation**: Startup routine reconciles database records with BullMQ Redis jobs, restoring missing jobs with their original schedule without duplicating existing jobs.
- **Deterministic Idempotency**: SHA-256 idempotency keys prevent duplicate email dispatch even under concurrent worker execution.
- **Atomic Hourly Rate Limiting**: Redis Lua script maintains atomic per-sender hourly quotas (e.g., 200 emails/hour). Excess emails are dynamically rescheduled into the next hour window.
- **Inter-Email Throttling**: Cross-worker Redis timestamp coordination guarantees a configurable minimum delay (e.g., 2000ms) between sends for the same sender.
- **Real Slack OAuth 2.0 Notifications**: Posts real-time alerts when a sender hits their hourly limit, deduplicated via Redis TTL locks.
- **Ethereal Email SMTP Integration**: Delivers actual emails through Ethereal SMTP with automatic test account provisioning and live message preview URLs.
- **Elasticsearch Search**: Full-text search on recipient, sender, subject, and body with fallback to PostgreSQL.
- **Live Bull-Board Dashboard**: Integrated administrative queue monitor displaying waiting, active, delayed, completed, and failed jobs.

---

## 2. Architecture Diagram

### System Architecture Flowchart

```mermaid
flowchart TD
    User([User / Browser])
    Dashboard[React + Vite Frontend\nTailwind CSS + TanStack Query]
    API[Express.js API Server\nTypeScript + Zod Validation]
    PG[(PostgreSQL Database\nPrisma ORM)]
    Redis[(Redis Cluster\nAOF Persistence)]
    BullQueue[BullMQ 'email-delivery' Queue]
    Workers[BullMQ Workers\nConcurrency: 5]
    ES[(Elasticsearch Cluster\nIndex: reachinbox-emails)]
    SMTP[Ethereal SMTP Provider\nNodemailer Transport]
    Slack[Slack Web API\nOAuth 2.0 Incoming Alerts]
    BullBoard[Bull-Board UI\nQueue Monitoring /api/admin/queues]

    User -->|HTTP / React UI| Dashboard
    Dashboard -->|REST API / Cookies| API
    API -->|Read / Write State| PG
    API -->|Atomic Rate Limit & Tokens| Redis
    API -->|Enqueue Delayed Jobs| BullQueue
    BullQueue -->|Persistent Queue Storage| Redis
    Workers -->|Consume Delayed Jobs| BullQueue
    Workers -->|Atomic Quota & Throttle Check| Redis
    Workers -->|Update Status: sent/failed| PG
    Workers -->|Deliver Emails| SMTP
    Workers -->|Rate Limit Exceeded Alert| Slack
    Workers -->|Async Document Indexing| ES
    API -->|Full-Text Search Query| ES
    API -->|Mount Queue Monitor| BullBoard
    BullBoard -->|Inspect Queue Metrics| BullQueue
```

### Job Scheduling & Rate-Limiting Execution Flow

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant Frontend as Frontend Dashboard
    participant API as Express API
    participant DB as PostgreSQL (Prisma)
    participant Redis as Redis (Lua Script)
    participant Queue as BullMQ (email-delivery)
    participant Worker as BullMQ Worker
    participant SMTP as Ethereal SMTP
    participant Slack as Slack Web API

    User->>Frontend: Upload CSV & Schedule Campaign
    Frontend->>API: POST /api/emails/schedule
    API->>API: Validate emails & remove duplicates
    API->>DB: Create Campaign & ScheduledEmail records
    API->>Queue: Enqueue delayed jobs (staggered delay)
    API->>DB: Store bullJobId & idempotencyKey
    API-->>Frontend: 201 Created (Scheduling Summary)

    Note over Queue,Worker: When job timer triggers...
    Queue->>Worker: Dispatch job to available worker
    Worker->>DB: Check email status (idempotency check)
    Worker->>DB: Transition status -> 'processing'
    Worker->>Redis: Execute Lua Script: checkAndConsumeHourlyLimit()
    
    alt Hourly Limit Exceeded (Count >= 200)
        Redis-->>Worker: Quota Exceeded (retryAfterMs, nextWindowStart)
        Worker->>Queue: Reschedule job into next hour window
        Worker->>DB: Update scheduledAt to next window & status -> 'scheduled'
        Worker->>Redis: Check deduplication key (slack:notified:sender:window)
        alt Not Yet Notified This Window
            Worker->>Slack: Send Rate Limit Alert Webhook
            Worker->>Redis: Set deduplication key with 3600s TTL
        end
    else Quota Available
        Redis-->>Worker: Quota Reserved (allowed=true)
        Worker->>Redis: Coordinate inter-email minimum delay (2000ms)
        Worker->>SMTP: Transmit email via Nodemailer
        SMTP-->>Worker: 250 OK (messageId, previewUrl)
        Worker->>DB: Transition status -> 'sent' (messageId, etherealUrl)
        Worker->>DB: Update campaign progress
    end
```

---

## 3. Technology Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React 18, Vite, TypeScript, Tailwind CSS, React Router v6, TanStack Query v5, Axios, PapaParse, Lucide React |
| **Backend** | Node.js (v20+ / v22), Express.js, TypeScript, Prisma ORM, BullMQ v5, ioredis, Nodemailer, @bull-board/express, Zod, Helmet |
| **Database** | PostgreSQL 16 |
| **Queue / Cache** | Redis 7 (with AOF persistence: `--appendonly yes`) |
| **Search Engine** | Elasticsearch 8.13 |
| **Email Protocol** | SMTP (Ethereal Email Test Transports) |
| **Integrations** | Google OAuth 2.0, Slack Web API OAuth 2.0 |
| **Testing** | Vitest |
| **Infrastructure** | Docker, Docker Compose |

---

## 4. Folder Structure

```
reachinbox-scheduler/
├── .env.example                     # Environment template
├── .gitignore                       # Git ignore configuration
├── docker-compose.yml               # PostgreSQL, Redis (AOF), Elasticsearch
├── package.json                     # Monorepo root scripts
├── README.md                        # Project documentation
│
├── sample-data/                     # Sample CSV test files for upload
│   ├── recipients_sample.csv        # 10 valid recipient contacts
│   └── recipients_invalid_mix.csv   # Mix of valid, invalid & duplicate emails
│
├── backend/
│   ├── package.json
│   ├── tsconfig.json
│   ├── prisma/
│   │   ├── schema.prisma            # PostgreSQL schema models
│   │   └── seed.ts                  # Database seeder with Ethereal provisioning
│   ├── src/
│   │   ├── config/
│   │   │   ├── env.ts               # Zod-validated environment config
│   │   │   ├── prisma.ts            # Prisma client singleton
│   │   │   └── redis.ts             # ioredis & BullMQ connection manager
│   │   ├── controllers/
│   │   │   ├── authController.ts    # Google OAuth & Dev Login
│   │   │   ├── campaignController.ts# Email campaign endpoints
│   │   │   ├── emailController.ts   # Scheduling, listing, stats & search
│   │   │   ├── senderController.ts  # Sender account management
│   │   │   └── slackController.ts   # Slack OAuth & webhook triggers
│   │   ├── integrations/
│   │   │   ├── elasticsearch.ts     # Elasticsearch client, indexer & search
│   │   │   ├── ethereal.ts          # Ethereal SMTP transporter & account creator
│   │   │   └── slack.ts             # Slack OAuth flow & rate-limit alerts
│   │   ├── middleware/
│   │   │   ├── auth.ts              # JWT / Cookie authentication middleware
│   │   │   └── error.ts             # Centralized Zod & Prisma error handler
│   │   ├── queues/
│   │   │   └── emailQueue.ts        # BullMQ delayed queue definition
│   │   ├── routes/
│   │   │   ├── authRoutes.ts
│   │   │   ├── campaignRoutes.ts
│   │   │   ├── emailRoutes.ts
│   │   │   ├── senderRoutes.ts
│   │   │   └── slackRoutes.ts
│   │   ├── services/
│   │   │   ├── emailService.ts      # Scheduling logic & email orchestration
│   │   │   ├── rateLimiter.ts       # Atomic Redis Lua rate limiting & throttling
│   │   │   ├── recoveryService.ts   # Startup queue reconciliation & recovery
│   │   │   └── senderService.ts     # Sender provisioning with Ethereal
│   │   ├── types/
│   │   │   └── index.ts             # Core backend TypeScript interfaces
│   │   ├── utils/
│   │   │   ├── crypto.ts            # AES-256-GCM encryption & idempotency hashing
│   │   │   └── logger.ts            # Structured colored logger
│   │   ├── workers/
│   │   │   ├── emailWorker.ts       # BullMQ worker process with concurrency
│   │   │   └── index.ts             # Standalone worker runner
│   │   ├── app.ts                   # Express app setup & Bull-Board mount
│   │   └── index.ts                 # Server bootstrap & recovery trigger
│   └── tests/
│       └── scheduler.test.ts        # Unit tests (crypto, validation, rate limiter)
│
└── frontend/
    ├── package.json
    ├── tsconfig.json
    ├── vite.config.ts
    ├── tailwind.config.js
    ├── postcss.config.js
    ├── index.html
    ├── src/
    │   ├── assets/
    │   ├── components/
    │   │   ├── ComposeModal.tsx     # CSV upload, drag-and-drop, delay/quota sliders
    │   │   ├── Header.tsx           # Global search & compose button
    │   │   ├── ScheduledTable.tsx   # Paginated scheduled emails table
    │   │   ├── SendersModal.tsx     # Sender account manager
    │   │   ├── SentTable.tsx        # Sent/failed table with Ethereal preview URLs
    │   │   ├── Sidebar.tsx          # Navigation, BullMQ link & user card
    │   │   ├── SlackModal.tsx       # Slack connection manager
    │   │   └── StatsCards.tsx       # 5 dashboard metric counters
    │   ├── contexts/
    │   │   └── AuthContext.tsx      # Authentication state & Google login
    │   ├── pages/
    │   │   ├── Dashboard.tsx        # Main application dashboard
    │   │   └── Login.tsx            # Google login & Developer login page
    │   ├── services/
    │   │   └── apiService.ts        # TanStack Query hooks & mutations
    │   ├── types/
    │   │   └── index.ts             # Frontend TypeScript models
    │   ├── utils/
    │   │   └── api.ts               # Axios instance with credentials
    │   ├── App.tsx                  # React Router configuration
    │   ├── index.css                # Tailwind base styles
    │   └── main.tsx                 # Entrypoint with QueryClientProvider
    └── tests/
        └── compose.test.ts          # Frontend CSV parsing & validation tests
```

---

## 5. Prerequisites

Before running the application, ensure you have:
- **Node.js**: `v20.x` or `v22.x` installed
- **npm**: `v10.x` or `v11.x` installed
- **Docker & Docker Compose**: Installed and running (for PostgreSQL, Redis, and Elasticsearch containers)

---

## 6. Installation Instructions

Clone the repository and install all dependencies:

```bash
# Clone the repository
git clone <repo-url>
cd reachinbox-scheduler

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install

# Return to root
cd ..
```

---

## 7. Docker Setup

Start the infrastructure containers (PostgreSQL, Redis with AOF, Elasticsearch):

```bash
# Start all containers in detached mode
docker-compose up -d

# Verify containers are healthy
docker-compose ps
```

To stop containers:
```bash
docker-compose down
```

---

## 8. PostgreSQL Setup & Prisma Migrations

Ensure PostgreSQL container is running, then run Prisma migrations:

```bash
cd backend

# Push schema to PostgreSQL database
npx prisma db push

# Generate the Prisma Client
npx prisma generate

# Seed initial developer account and sample campaign
npx prisma db seed
```

---

## 9. Redis Setup

Redis is configured in `docker-compose.yml` with:
- Image: `redis:7-alpine`
- Persistence: `--appendonly yes --appendfsync everysec`
- Port: `6379:6379`
- Persistent Volume: `redis_data:/data`

This guarantees that BullMQ delayed job keys and atomic rate-limit counters survive unexpected process or container restarts.

---

## 10. Elasticsearch Setup

Elasticsearch is configured in `docker-compose.yml` with:
- Image: `docker.elastic.co/elasticsearch/elasticsearch:8.13.4`
- Discovery: `discovery.type=single-node`
- Memory: `ES_JAVA_OPTS=-Xms512m -Xmx512m`
- Port: `9200:9200`
- Index: `reachinbox-emails` (automatically created on backend startup with email analyzer and text mappings)

*Note: PostgreSQL remains the primary source of truth. If Elasticsearch is unreachable, search queries transparently fall back to PostgreSQL `ILIKE` queries.*

---

## 11. Google OAuth Configuration

1. Visit [Google Cloud Console](https://console.cloud.google.com/apis/credentials).
2. Create an **OAuth 2.0 Client ID** (Web application).
3. Add Authorized Redirect URI: `http://localhost:5000/api/auth/google/callback`.
4. Copy `Client ID` and `Client Secret` into `.env`.

*(For immediate local evaluation without Google credentials, ReachInbox includes an **Instant Developer Login** button on the `/login` page).*

---

## 12. Slack OAuth Configuration

1. Visit [Slack API Apps](https://api.slack.com/apps).
2. Create a New App ("ReachInbox Scheduler") in your workspace.
3. Under **OAuth & Permissions**, add Redirect URL: `http://localhost:5000/api/slack/callback`.
4. Add Bot Scopes: `chat:write`, `chat:write.public`, `incoming-webhook`, `channels:read`.
5. Copy `Client ID` and `Client Secret` into `.env`.

When a sender exceeds their hourly limit:
- Worker calls Slack Web API (`chat.postMessage` or webhook).
- Sends formatted markdown message block.
- Deduplicated via Redis key `slack:notified:${senderId}:${hourWindow}` with 1-hour TTL.

---

## 13. Ethereal SMTP Configuration

Ethereal is a fake SMTP service for development and testing:
- Transports are managed via Nodemailer.
- If credentials are not specified, ReachInbox calls `nodemailer.createTestAccount()` on the fly.
- For every dispatched email, Nodemailer captures the message ID and test preview URL:
  `nodemailer.getTestMessageUrl(info)` (e.g. `https://ethereal.email/message/WaQKMg...`).
- These links are clickable directly from the **Sent Emails** dashboard tab.

---

## 14. Environment Variables

Create `.env` in the root (or `backend/`):

```ini
# Node Environment
NODE_ENV=development
PORT=5000
FRONTEND_URL=http://localhost:5173
BACKEND_URL=http://localhost:5000

# PostgreSQL Database
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/reachinbox?schema=public"

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Elasticsearch
ELASTICSEARCH_NODE=http://localhost:9200

# Google OAuth 2.0
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_CALLBACK_URL=http://localhost:5000/api/auth/google/callback

# Slack OAuth 2.0
SLACK_CLIENT_ID=your-slack-client-id
SLACK_CLIENT_SECRET=your-slack-client-secret
SLACK_REDIRECT_URI=http://localhost:5000/api/slack/callback

# Security & Secrets
JWT_SECRET=reachinbox-super-secure-jwt-secret-key-32-chars-min!
SESSION_SECRET=reachinbox-session-secret-key-change-in-production
ENCRYPTION_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef

# Default Ethereal SMTP (optional - auto-provisioned if omitted)
ETHEREAL_HOST=smtp.ethereal.email
ETHEREAL_PORT=587
ETHEREAL_USER=
ETHEREAL_PASS=

# Worker & Rate Limiting Configuration
WORKER_CONCURRENCY=5
MIN_DELAY_BETWEEN_EMAILS_MS=2000
MAX_EMAILS_PER_HOUR_PER_SENDER=200
```

---

## 15. Running Backend, Frontend & Workers

### Start Backend:
```bash
cd backend
npm run dev
```
*Backend runs on `http://localhost:5000`.*

### Start Frontend:
```bash
cd frontend
npm run dev
```
*Frontend runs on `http://localhost:5173`.*

### Start Monorepo Concurrently (Root):
```bash
npm run dev
```

### Standalone Worker (Optional):
```bash
cd backend
npm run worker
```

---

## 16. BullMQ Dashboard Access

The administrative queue dashboard is served via `@bull-board/express`:
- **URL**: `http://localhost:5000/api/admin/queues`
- **Features**: Live queue metrics, waiting, active, delayed, completed, and failed job inspector.
- **Link**: Click the **BullMQ Dashboard ↗** link in the frontend sidebar navigation.

---

## 17. REST API Documentation

### Authentication
- `GET /api/auth/google` – Redirect to Google OAuth consent
- `GET /api/auth/google/callback` – Google OAuth callback & JWT cookie creation
- `POST /api/auth/dev-login` – Instant developer login helper
- `GET /api/auth/me` – Current authenticated user profile
- `POST /api/auth/logout` – Clear authentication cookie

### Emails & Scheduling
- `POST /api/emails/schedule` – Validate and schedule email campaign
- `GET /api/emails/scheduled` – Get paginated scheduled emails
- `GET /api/emails/sent` – Get paginated sent/failed emails
- `GET /api/emails/:id` – Get single email details
- `GET /api/emails/search` – Full-text search (Elasticsearch / DB fallback)
- `GET /api/emails/stats` – Get dashboard metrics (total, scheduled, sent, failed, remaining quota)

### Campaigns
- `POST /api/campaigns` – Create campaign
- `GET /api/campaigns` – List campaigns
- `GET /api/campaigns/:id` – Get campaign details & email list

### Senders
- `GET /api/senders` – List user senders
- `POST /api/senders` – Create sender (with 1-click Ethereal account creation)
- `PATCH /api/senders/:id` – Update sender
- `DELETE /api/senders/:id` – Delete sender

### Slack
- `GET /api/slack/connect` – Initiate Slack OAuth authorization flow
- `GET /api/slack/callback` – Exchange Slack OAuth code & store encrypted token
- `GET /api/slack/status` – Slack connection status & workspace name
- `POST /api/slack/disconnect` – Revoke Slack token & disconnect

### System
- `GET /api/health` – Server health status, uptime, and environment

---

## 18. Scheduling Architecture & Delayed Jobs

ReachInbox **does not use cron jobs, node-cron, or OS scheduling**.

All scheduling is handled through **BullMQ Redis-backed delayed jobs**:
1. When scheduling a campaign, the start time and staggered delays are calculated:
   $$\text{scheduledAt}_i = \text{startTime} + (i \times \text{delayBetweenEmails})$$
2. Delay in milliseconds passed to BullMQ:
   $$\text{delay} = \max(0, \text{scheduledAt}_i - \text{now})$$
3. BullMQ holds delayed jobs in a Redis sorted set (`bull:email-delivery:delayed`) scored by timestamp.
4. When the delay expires, Redis moves the job to the waiting queue, and an available worker claims it.

---

## 19. Restart Recovery Strategy

When the backend process crashes or restarts:
1. `RecoveryService.reconcileAndRecoverJobs()` runs automatically during `bootstrap()`.
2. Inspects database records where `status IN ('scheduled', 'processing')`.
3. For each record:
   - Queries BullMQ: `await queue.getJob(jobId)` where `jobId = "email-job-${id}"`.
   - **Case A (Job exists in Redis)**: The job survived via Redis AOF persistence. If DB was in `processing`, it is reset to `scheduled`. No duplicate is enqueued.
   - **Case B (Job missing from Redis)**: Calculates remaining delay based on original `scheduledAt`. Re-enqueues the job into BullMQ with its deterministic stable `jobId`.
4. Guarantees that future jobs fire at their exact intended times without duplicate dispatch.

---

## 20. Idempotency Implementation

To prevent duplicate email sends:
1. **Deterministic Idempotency Key**:
   $$\text{idempotencyKey} = \text{SHA-256}(\text{userId} + \text{senderId} + \text{normalizedRecipient} + \text{campaignId} + \text{scheduledAt})$$
2. Unique database constraint on `ScheduledEmail.idempotencyKey`.
3. Unique constraint on `ScheduledEmail.bullJobId`.
4. Worker checks: if `emailRecord.status === 'sent'`, the job aborts immediately with success.

---

## 21. Hourly Rate Limiting with Atomic Redis Lua Script

To enforce `MAX_EMAILS_PER_HOUR_PER_SENDER=200` without race conditions across multiple workers:

```lua
local current = redis.call('GET', KEYS[1])
if current and tonumber(current) >= tonumber(ARGV[1]) then
    return {0, tonumber(current)} -- Limit reached
else
    local count = redis.call('INCR', KEYS[1])
    if count == 1 then
        redis.call('EXPIRE', KEYS[1], tonumber(ARGV[2]))
    end
    return {1, count} -- Quota allocated
end
```

When quota is exhausted:
1. Worker calculates next hour window start (e.g. `16:00:00.000Z`).
2. Job is rescheduled into BullMQ with delay to that window.
3. Database record `scheduledAt` is updated and reset to `scheduled`.
4. Slack alert is triggered (deduplicated per sender per hour window).

---

## 22. Inter-Email Send Throttling (`MIN_DELAY_BETWEEN_EMAILS_MS`)

To enforce a 2000ms minimum gap between emails for the same sender across concurrent workers:
- Key: `throttle:sender:${senderId}:next_available`
- Workers atomically reserve their execution timestamp slot via Redis Lua script before invoking SMTP.
- Prevents burst delivery violations with SMTP providers.

---

## 23. Slack Notification Deduplication

When a rate limit is triggered:
- Redis key: `slack:notified:${senderId}:${hourWindow}`
- Set with `EX 3600` (1-hour TTL).
- Concurrent workers hitting the limit in the same hour window check this key and suppress duplicate notifications.

---

## 24. Elasticsearch Synchronization

- Upon creation and status transitions (`scheduled`, `sent`, `failed`), documents are asynchronously synchronized to the `reachinbox-emails` Elasticsearch index.
- If Elasticsearch is temporarily unavailable, queue workers do not fail—PostgreSQL remains the source of truth.
- The search endpoint `/api/emails/search` queries Elasticsearch with multi-match fuzziness on `subject`, `body`, and email fields, automatically falling back to PostgreSQL if Elasticsearch is offline.

---

## 25. Testing Instructions

Run the complete test suite across the monorepo:

```bash
# Run backend and frontend tests from root
npm test

# Run backend tests only
npm run test:backend

# Run frontend tests only
npm run test:frontend
```

Test coverage includes:
- Idempotency key hashing and casing normalization
- AES-256-GCM token encryption and decryption
- RFC compliant email validation
- Schedule payload and sender schema validation
- Rate limiter UTC hour window calculation and rollover
- Frontend PapaParse CSV column auto-detection and duplicate elimination

---

## 26. Known Limitations and Trade-Offs

1. **SMTP Exactly-Once Delivery Limitation**:
   SMTP does not support two-phase commit (2PC) transactions. If a worker process is forcibly killed (e.g., `kill -9` or hardware fault) after the remote SMTP server accepts the message (250 OK) but before the database transaction marks `status = 'sent'`, there is a theoretical risk of duplicate delivery on restart. ReachInbox minimizes this window to under 5 milliseconds by placing the database status update immediately adjacent to SMTP acceptance.
2. **Elasticsearch Eventual Consistency**:
   Elasticsearch document indexing is performed asynchronously so as not to add latency to queue processing. In high-throughput bursts, search results may trail PostgreSQL by a fraction of a second.
3. **Ethereal Mail Delivery Speed**:
   Ethereal Email is a testing SMTP relay. While real SMTP handshakes and email previews are generated, delivering thousands of test emails is subject to Ethereal's test server throughput.

---

## 27. License

ReachInbox Full-Stack Email Job Scheduler – Hiring Assignment Implementation.
