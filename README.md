# LabSense - AI Lab Assistant

## 🏥 Project Overview & Application Motive

**LabSense AI** is an intelligent, longitudinal personal health tech platform designed for lab report analysis, parameter trend tracking, and RAG-assisted medical guidance.

### Core Application Vision:
- **Longitudinal Personal Health Profile:** Each user account builds a private, continuous health history timeline. Uploading lab reports regularly enables clear trend visualization across blood, metabolic, renal, and liver panels.
- **Context-Aware AI Assistant (RAG Engine):** Retrieves insights strictly from the authenticated user's uploaded reports and curated medical guidelines, preventing cross-user data confusion.
- **Deterministic Parameter Triage:** Combines clinical rule-based validation (normal vs. out-of-reference intervals) with a 4-step pathophysiological medical reasoning chain.
- **Admin Management & Storage Explorer:** Integrated administration console for PostgreSQL table inspection, raw SQL execution, MinIO S3 object storage management, and user role control.

---

## 🛠️ Technology Stack

| Layer | Technologies Used |
| :--- | :--- |
| **Frontend UI** | React 18, Vite, Tailwind CSS, Lucide React, Recharts, TanStack Query |
| **Backend API** | Node.js, Express 5, JWT Authentication, Multer, Bcrypt |
| **Database** | PostgreSQL 16 (`pg`, GIN Trigram indexing for RAG vector search) |
| **Object Storage** | MinIO S3 API Client (`minio`) with local disk fallback (`uploads/`) |
| **AI / LLM Engine** | Groq API (`qwen3.6-27b`) + Curated Medical Knowledge Base + Client RAG Engine |
| **Containerization** | Docker, Docker Compose, Nginx SPA proxy |

---

## 📁 Repository Directory Structure

```text
lab_assistant/
├── server/                           # Express Backend Server
│   ├── index.js                      # Main Express routes & API handlers
│   ├── db.js                         # PostgreSQL connection pool & health checks
│   ├── minioClient.js                # MinIO S3 storage client & local fallback
│   ├── schema.sql                    # Database migrations, tables & indexes
│   ├── init-db.js                    # Auto-migration runner on startup
│   ├── emailService.js               # SMTP / Nodemailer OTP dispatch service
│   ├── ragService.js                 # Server-side RAG chunk search & indexing
│   ├── medicalKnowledgeBase.js       # Curated clinical guideline database
│   ├── medicalReasoningService.js    # 4-step pathophysiological rationale engine
│   └── Dockerfile                    # Backend container build script
│
├── src/                              # React Frontend Application
│   ├── components/                   # Reusable UI components & layouts
│   │   ├── AppLayout.jsx             # Top glassmorphic header & mobile navigation
│   │   ├── UserProfileDialog.jsx     # User profile, 2FA security, & OTP verification
│   │   ├── MedicalReasoningCard.jsx  # 4-step clinical reasoning card
│   │   └── ui/                       # Shadcn Tailwind UI components
│   ├── pages/                        # Page Views
│   │   ├── Upload.jsx                # Report file upload & OCR parsing
│   │   ├── Dashboard.jsx             # Health metrics, trend graphs & summaries
│   │   ├── Assistant.jsx             # RAG-assisted medical AI chat interface
│   │   └── admin/                    # Admin login & multi-tab management portal
│   ├── features/auth/                # AuthProvider, ProtectedRoute & AdminRoute
│   ├── lib/                          # API client, OCR, risk prediction, local fallback
│   └── tests/                        # Vitest automated test suite
│
├── docker-compose.yml                # Multi-container stack definition
├── Dockerfile                        # Frontend Nginx container build script
└── README.md                         # Developer documentation & onboarding guide
```

---

## ⚡ Quick Start for Developers

### 1. Local Development (Without Docker)

1. **Install Dependencies:**
   ```bash
   npm install
   ```

2. **Configure Environment Variables:**
   Create a `.env` file in the root directory (refer to `server/.env.example`):
   ```env
   PORT=5000
   JWT_SECRET=your_jwt_secret_key_here
   VITE_GROQ_API_KEY=your_groq_api_key_here
   POSTGRES_HOST=localhost
   POSTGRES_PORT=5432
   POSTGRES_USER=postgres
   POSTGRES_PASSWORD=your_password
   POSTGRES_DB=lab_assistant
   ```

3. **Start Development Server (Frontend + Backend):**
   ```bash
   npm run dev
   ```
   - 🌐 **Frontend App:** `http://localhost:8080` (or Vite assigned port)
   - ⚙️ **Backend Server:** `http://localhost:5000`

---

### 2. Containerized Start (Docker Compose)

Run the full container stack (PostgreSQL, MinIO, Backend Server, Nginx Frontend):

```bash
docker compose up -d
```

#### Service Endpoints:
- 🌐 **Web App:** `http://localhost:8080`
- ⚙️ **Express API:** `http://localhost:5000/api`
- 🗄️ **MinIO Storage Console:** `http://localhost:9001` *(User: `minioadmin` / Pass: `minioadminpassword`)*
- 📊 **PostgreSQL Database:** `localhost:5432` *(Database: `lab_assistant`)*

---

## 🧪 Testing & Verification

Run the Vitest test suite to verify security, database models, and AI assistant logic:

```bash
npm test
```

Build the production frontend bundle:

```bash
npm run build
```

---

## 🔑 Default Admin Credentials

- **Email:** `admin@labsense.com`
- **Password:** `admin123`
- **Role:** Administrator (Access to Admin Portal at `/admin/dashboard`)
