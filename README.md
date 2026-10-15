# 🏥 LabSense AI - Clinical Lab Assistant & Health Intelligence Platform

[![Vite](https://img.shields.io/badge/Vite-5.4-646CFF?style=flat&logo=vite&logoColor=white)](https://vitejs.dev/)
[![React](https://img.shields.io/badge/React-18.3-61DAFB?style=flat&logo=react&logoColor=black)](https://react.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-38B2AC?style=flat&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Express](https://img.shields.io/badge/Express-5.0-000000?style=flat&logo=express&logoColor=white)](https://expressjs.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?style=flat&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![MinIO](https://img.shields.io/badge/MinIO-S3_Storage-C72C48?style=flat&logo=minio&logoColor=white)](https://min.io/)
[![Docker](https://img.shields.io/badge/Docker_Compose-Supported-2496ED?style=flat&logo=docker&logoColor=white)](https://www.docker.com/)

LabSense AI is a full-stack, longitudinal clinical health intelligence application. It extracts medical parameters from patient lab reports (PDF/images), performs rule-based and pathophysiological clinical reasoning, visualizes longitudinal health trends, and powers context-aware medical AI conversations using a Dual-Source Retrieval-Augmented Generation (RAG) pipeline.

---

## 🌟 Key Application Features

### 1. 📄 Smart Report Ingestion & OCR Parsing
- Upload lab reports in **PDF, PNG, JPG** formats (up to 15 MB).
- Client & server-side OCR extracts clinical parameters, reference ranges, and diagnostic notes.
- Securely stored in **MinIO S3 Object Storage** (with automated local disk fallback in `./uploads`).

### 2. 🧪 Clinical Parameter Triage & Panels
- Automated detection and reference interval categorization for major lab markers:
  - **Complete Blood Count (CBC):** Hemoglobin, WBC, RBC, Platelets, Hematocrit, MCV, MCH, MCHC, Neutrophils, Lymphocytes, Monocytes, Eosinophils, Basophils.
  - **Renal Panel:** Creatinine, Urea, Blood Urea Nitrogen (BUN).
  - **Electrolytes Panel:** Sodium, Potassium, Chloride, Calcium.
  - **Hepatic / Liver Panel:** AST (SGOT), ALT (SGPT), ALP, Total Bilirubin.
  - **Metabolic & Glycemic:** Fasting / Random Blood Glucose, HbA1c.
  - **Inflammatory Biomarkers:** C-Reactive Protein (CRP).

### 3. 🧠 4-Step Clinical Reasoning Engine
Every analyzed lab report is triaged through a structured medical reasoning chain:
1. **Observation & Triaging:** Isolates out-of-reference biomarkers with exact quantitative values.
2. **Pathophysiological Mechanisms:** Analyzes underlying biological processes (e.g., microcytic anemia, renal clearance impairment).
3. **Differential Considerations:** Highlights potential causes and clinical patterns to evaluate.
4. **Physician Action Plan:** Generates tailored questions to guide doctor consultations, complete with one-click clipboard copying.

### 4. 💬 Dual-Source RAG AI Health Assistant
- **Real-Time Streaming AI:** Connects to Groq LLM API (`openai/gpt-oss-20b`, `qwen/qwen3.8-27b`) with robust offline rule-based fallbacks.
- **Strict User Isolation:** GIN Trigram vector indexing searches only the authenticated user's uploaded reports and curated clinical reference guidelines.
- **Evidence Sources:** Transparently cites the exact report files and dates used to answer each query.

### 5. 📈 Longitudinal Trend Visualization
- Interactive multi-report trend graphs powered by **Recharts**.
- Visualizes progression of Hemoglobin, WBC, Platelets, and other biomarkers across successive visits.

### 6. 🩺 Specialist Consultation Booking
- Browse board-certified specialists (Hematologists, Endocrinologists, Hepatologists).
- Schedule HD Video or In-Person consultations with automated recommendations based on abnormal lab findings.

### 7. 🛡️ Interactive Admin Console (`/admin/dashboard`)
- **System Telemetry:** Real-time metrics on users, storage usage, reports, and API activity.
- **PostgreSQL Inspector:** View schemas, row counts, and live table data.
- **Interactive SQL Console:** Execute queries directly against the database with safety controls.
- **MinIO Storage Explorer:** Browse, download, inspect, and delete report files stored in buckets.
- **User Role Management:** Promote users, toggle roles, and manage system access.

### 8. 🎨 Polished Modern UI & Theme System
- Built on **Urbanist** typography and translucent glassmorphism (`glass-card`, `glass-panel`).
- **Seamless Theming:** Instant switching between **Light**, **Obsidian Glass Dark** (`#070b14`), and **System** mode.
- Fully responsive layout bounded for optimal viewing on desktop, ultrawide, tablet, and mobile.

---

## 🛠️ Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend UI** | React 18, Vite, Tailwind CSS, Lucide React, Recharts, Radix UI, TanStack Query |
| **Theming** | `next-themes` (Light, Dark Obsidian Glass, System) |
| **Backend API** | Node.js, Express 5, JWT Authentication, Cookie Parser, Multer, Bcrypt |
| **Database** | PostgreSQL 16 (`pg`, GIN Trigram indexing for RAG search) |
| **Object Storage** | MinIO S3 API Client (`minio`) with automatic disk fallback (`./uploads`) |
| **Clinical AI** | Groq Cloud API + Curated Medical Guidelines + Local Rule-Based Engine |
| **Containerization** | Docker, Docker Compose, Alpine PostgreSQL, MinIO AIStor |

---

## 🚀 Quick Start: Team Setup (Option A — Independent Docker Setup)

If you and your team members are collaborating from different locations, **you do not need to install PostgreSQL or MinIO software manually on your machines**.

All database engines and storage services are managed cleanly via **Docker**.

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher)
- [Git](https://git-scm.com/)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (installed and running)

---

### Step-by-Step Developer Setup

#### 1. Clone the Repository
```bash
git clone https://github.com/your-username/lab_assistant.git
cd lab_assistant
```

#### 2. Install Node Dependencies
```bash
npm install
```

#### 3. Configure Your Environment (`.env`)
Copy the provided `.env.example` to create your local `.env`:
```bash
cp .env.example .env
```
*(On Windows PowerShell, run: `Copy-Item .env.example .env`)*

The `.env.example` comes pre-configured with default credentials matching Docker:
- **PostgreSQL Port:** `5432` | **User:** `postgres` | **Password:** `postgrespassword`
- **MinIO Port:** `9000` (API) & `9001` (Console) | **User:** `minioadmin` | **Password:** `minioadminpassword`
- **Optional:** Add your free Groq API Key (`VITE_GROQ_API_KEY`) from [console.groq.com](https://console.groq.com/keys) for live AI chat streaming.

#### 4. Start PostgreSQL & MinIO via Docker
Run the pre-configured npm script:
```bash
npm run docker:up
```
*(Or run `docker compose up -d postgres minio` directly).*

Docker will download and boot up PostgreSQL and MinIO in the background. The database schema in `server/schema.sql` and default administrator account will automatically initialize on first launch.

#### 5. Start the Application (Frontend + Backend)
Run the concurrent development server:
```bash
npm run dev
```
This single command automatically starts:
- 🌐 **React Frontend (Vite):** [http://localhost:3000](http://localhost:3000)
- ⚙️ **Express Backend API:** [http://localhost:5000](http://localhost:5000)

---

### Alternative: Run the Entire Application in Docker
If you want to run the frontend, backend, database, and storage entirely inside Docker containers without local Node.js:
```bash
npm run docker:all
```
*(Or run `docker compose up -d --build`)*

---

### Stopping Docker Services
When you are done developing, stop the background containers with:
```bash
npm run docker:down
```

---

## 🔑 Default Credentials

### Administrator Portal
- **URL:** [http://localhost:3000/admin/login](http://localhost:3000/admin/login) (or via the Admin Portal link in navigation)
- **Email:** `admin@labsense.com`
- **Password:** `admin123`
- **Permissions:** Full access to DB Inspector, SQL Query Console, MinIO File Explorer, and User Management.

### MinIO Web Console
- **URL:** [http://localhost:9001](http://localhost:9001)
- **Username:** `minioadmin`
- **Password:** `minioadminpassword`

---

## 🧪 Testing & Verification

Run the comprehensive Vitest test suite (verifying RAG engine, AI response formatting, database connectivity, and security models):
```bash
npm test
```

Run tests in watch mode:
```bash
npm run test:watch
```

Test production build compilation:
```bash
npm run build
```

---

## 📁 Repository Directory Structure

```text
lab_assistant/
│
├── frontend/                         # 🎨 React Frontend Application
│   ├── src/                          # Application source code
│   │   ├── components/               # AppLayout, MedicalReasoningCard, UI primitives
│   │   ├── pages/                    # Upload, Dashboard, Assistant, Appointments, Admin
│   │   ├── features/auth/            # AuthProvider, ProtectedRoute & Role Guards
│   │   ├── lib/                      # Groq service, client RAG engine, OCR & API clients
│   │   └── tests/                    # Frontend Vitest test suites
│   ├── index.html                    # HTML entry point
│   ├── vite.config.js                # Vite build & proxy configuration
│   ├── vitest.config.js              # Vitest test runner configuration
│   ├── tailwind.config.js            # Tailwind CSS styling & theme tokens
│   ├── components.json               # Shadcn UI configuration
│   ├── Dockerfile                    # Frontend Nginx production container
│   ├── nginx.conf                    # Nginx SPA routing configuration
│   ├── package.json                  # Isolated frontend dependencies
│   └── .env.example                  # Frontend environment configuration template
│
├── backend/                          # ⚙️ Express Node.js Backend API
│   ├── index.js                      # Express API routes, report processing & middleware
│   ├── db.js                         # PostgreSQL connection pool & health checks
│   ├── minioClient.js                # MinIO S3 client with local disk fallback
│   ├── schema.sql                    # Database migrations, tables & indexes
│   ├── init-db.js                    # Database startup auto-migration runner
│   ├── emailService.js               # 2FA / OTP email dispatch service
│   ├── ragService.js                 # Server-side RAG chunk search & GIN indexing
│   ├── medicalKnowledgeBase.js       # Curated clinical guideline database
│   ├── medicalReasoningService.js    # 4-step pathophysiological rationale engine
│   ├── encryptionService.js          # AES-256-GCM data encryption service
│   ├── middlewares/                  # JWT auth & role validation middlewares
│   ├── tests/                        # Backend Vitest test suites (security & encryption)
│   ├── Dockerfile                    # Backend Node.js container build script
│   ├── package.json                  # Isolated backend dependencies
│   └── .env.example                  # Backend environment configuration template
│
├── docker-compose.yml                # Multi-container orchestration (Postgres, MinIO, Backend, Frontend)
├── package.json                      # Root npm workspace orchestrator (runs both frontend & backend)
└── README.md                         # Master documentation & developer onboarding guide
```

---

## ⚕️ Medical Disclaimer

*LabSense AI is designed for educational, informational, and personal wellness monitoring purposes only. The automated parameter triage, clinical reasoning chains, and AI assistant replies do not constitute medical diagnosis, treatment advice, or formal clinical prescriptions. Always consult a board-certified physician or qualified healthcare provider with any medical questions or diagnostic concerns.*
