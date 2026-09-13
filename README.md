# Agentic School ERP V1.0 🎓⚡

> **An enterprise-grade, multi-tenant Autonomous School Management & ERP platform powered by NestJS, Next.js 14, and Google Gemini AI.**

---

## 🏛️ System Architecture

Agentic School ERP is engineered as a high-performance monorepo designed for institutional scalability, strict multi-tenant data isolation, and autonomous administrative intelligence.

```
AI School ERP V1.0/
├── apps/
│   ├── api/                     # Backend: NestJS 10 REST API, Prisma ORM, JWT Auth, AI Agents
│   └── web/                     # Frontend: Next.js 14 (App Router), Responsive Web & PWA
├── packages/
│   └── shared-types/            # Shared TypeScript definitions and data contracts
├── nginx/
│   └── nginx.conf               # Production reverse proxy and SSL gateway
├── scripts/
│   └── maintenance/             # Administrative DB maintenance, seeding, and migration scripts
├── .github/
│   └── workflows/ci.yml         # Automated CI/CD testing and build verification pipeline
├── docker-compose.yml           # Multi-container orchestration (API, Web, Postgres, Nginx)
└── docker-compose.dev.yml       # Local development backing services
```

### 📱 Client Architecture: Web & Responsive PWA
The client layer is built entirely with Next.js 14 using responsive, mobile-first design principles. Rather than relying on separate unmaintained native apps, all student, parent, teacher, and administrative interfaces are delivered via a high-performance **Progressive Web App (PWA)** that runs consistently across modern mobile browsers (iOS Safari, Android Chrome), tablets, and desktop workstations.

---

## 🛡️ Security & Enterprise Hardening

- **Multi-Tenant Isolation**: Enforces fail-closed `requireSchoolId` checks across all queries and database mutations, preventing cross-tenant data leaks.
- **Role-Based Access Control (RBAC)**: Fine-grained `@Roles()` annotations enforced by `JwtAuthGuard` and `RolesGuard` covering `SUPER_ADMIN`, `SCHOOL_ADMIN`, `PRINCIPAL`, `TEACHER`, `STUDENT`, and `PARENT`.
- **IDOR Protection**: Object-level authorization prevents unauthorized access to student academic performance and report cards.
- **Automated Audit Logging**: `AuditLogInterceptor` automatically audits all mutating HTTP requests (`POST`, `PUT`, `PATCH`, `DELETE`) to PostgreSQL `ActivityLog` records with user, timestamp, tenant, and sanitized state snapshots.
- **Prompt Injection Defense**: AI assistant action parsing validates structured schemas with role verification before generating actionable recommendations, ensuring raw action tags from user inputs are sanitized.
- **Collision-Free Receipts**: Fee payments generate unique, entropy-rich receipts (`RCT-YYYY-TIMESTAMP-RANDOM`) eliminating concurrency race conditions.
- **Attendance Date Lock**: Strict 7-day retrospective lock and future-date validation preventing unauthorized backdating or forward-dating.

---

## 🤖 Agentic Autonomous Operations

The ERP features an embedded AI assistant and background agent monitoring system powered by Google Gemini:
- **Principal Intelligence**: Natural language queries and semantic routing for administrative workflows.
- **Fee Defaulter Workflow**: Automated detection and batched notification dispatch.
- **Timetable Cover Suggestions**: Intelligent substitute teacher assignment when leaves are approved.
- **Attendance & Drop-Out Alerts**: Predictive student risk analysis.
- **Copilot Tools**: Automated lesson plan drafting and report card remark generation.

---

## 🚀 Quickstart & Development Setup

### Prerequisites
- **Node.js**: `v20.x` or higher
- **npm**: `v10.x` or higher
- **PostgreSQL**: `v15.x` or higher
- **Docker**: (Optional, for containerized execution)

### 1. Installation
Clone the repository and install dependencies:
```bash
git clone <repository-url>
cd "AI School ERP V1.0"
npm install
```

### 2. Environment Configuration
Copy the sample environment file and configure database and secret keys:
```bash
cp .env.example .env
```
Key environment variables:
```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/school_erp?schema=public"
JWT_SECRET="super-secret-jwt-access-key-minimum-32-characters"
JWT_REFRESH_SECRET="super-secret-jwt-refresh-key-minimum-32-characters"
GEMINI_API_KEY="your-google-gemini-api-key"
PORT=4000
CORS_ORIGIN="http://localhost:3000"
```

### 3. Database Initialization
Generate the Prisma Client and push the schema to PostgreSQL:
```bash
npx prisma generate --schema=apps/api/prisma/schema.prisma
npx prisma db push --schema=apps/api/prisma/schema.prisma
```

### 4. Running the Development Servers
Start both backend API (`:4000`) and frontend client (`:3000`):
```bash
npm run dev
```
- **Web App**: `http://localhost:3000`
- **REST API**: `http://localhost:4000/api`
- **Swagger Documentation**: `http://localhost:4000/api/docs` (in development mode)

---

## 🧪 Testing & Verification

Run automated test suites and compile builds:
```bash
# Run backend unit and integration tests
npm test --workspace=apps/api

# Verify NestJS production build
npm run build --workspace=apps/api

# Verify Next.js web compilation
npm run build --workspace=apps/web
```

---

## 🐳 Docker Deployment

The system is equipped with production multi-stage Alpine Docker images:
```bash
# Build and run the entire stack with Docker Compose
docker compose up -d --build

# Inspect container status
docker compose ps
```

---

## 📄 License
Private and Proprietary — AI School ERP V1.0. All Rights Reserved.
