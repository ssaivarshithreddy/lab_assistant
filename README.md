# LabSense - AI Lab Assistant

## Project Overview

LabSense is a full-stack health-tech web application designed for comprehensive lab report analysis, RAG-assisted medical reasoning, and object storage management.

### Key Capabilities:
- **Health Report Processing:** Upload lab reports (PDF/Images) with PDF text extraction + Tesseract OCR fallback.
- **Deterministic Parameter Extraction:** Regex and clinical rule engine parameter validation for CBC, LFT, KFT, Glycemic, and Lipid panels.
- **Clinical Medical Reasoning Chain:** 4-step medical rationale (Observation & Triaging → Pathophysiological Mechanisms → Differential Considerations → Physician Questions).
- **Dual-Source 5-Step RAG Assistant:** Searches Curated Medical Knowledge Base + User Historical Reports.
- **PostgreSQL Database Inspector & Admin Console:** Interactive table browser, raw SQL query runner, and RAG chunk manager.
- **MinIO Object Storage & File Manager:** Microservice object storage handling PDF/image uploads with local disk fallback.
- **Containerized Architecture:** Fully containerized setup via `docker-compose.yml` for Node.js, PostgreSQL, MinIO, and Nginx React UI.

---

## Tech Stack

- **Frontend:** React 18, Vite, Tailwind CSS, Lucide React, Recharts, TanStack Query
- **Backend API:** Node.js, Express, JWT Authentication, Multer
- **Database:** PostgreSQL 16 (`pg`, `uuid-ossp`, `pg_trgm` trigram search)
- **Object Storage:** MinIO S3 Object Storage API (`minio`)
- **AI & RAG Engine:** Groq API (Llama3 model) + Curated Medical Knowledge Base + PostgreSQL GIN Trigram Vector Search
- **Containerization:** Docker, Docker Compose, Nginx

---

## Folder Structure

```text
├── server/
│   ├── index.js              # Express API server & routes
│   ├── db.js                 # PostgreSQL connection pool
│   ├── minioClient.js        # MinIO S3 object storage client
│   ├── schema.sql            # Postgres database migrations & indexes
│   └── Dockerfile            # Node.js backend Dockerfile
├── src/
│   ├── components/           # UI cards, Medical Reasoning cards, layout
│   ├── features/auth/        # Auth provider & route guards
│   ├── lib/                  # RAG engine, Medical Knowledge Base, Groq API
│   ├── pages/                # Upload, Dashboard, Assistant, Admin Portal
│   └── services/             # Admin stats & API client wrappers
├── docker-compose.yml        # Docker Compose stack (Postgres, MinIO, Backend, Frontend)
├── Dockerfile                # Frontend multi-stage Nginx Dockerfile
└── nginx.conf                # Nginx SPA fallback configuration
```

---

## Quick Start with Docker

Run the entire application stack with a single command:

```bash
docker compose up -d
```

### Application Endpoints:
- 🌐 **React Application:** `http://localhost:8080`
- ⚙️ **Backend API:** `http://localhost:5000/api`
- 🗄️ **MinIO Storage Console:** `http://localhost:9001` *(User: `minioadmin` / Password: `minioadminpassword`)*
- 📊 **PostgreSQL Database:** `localhost:5432` *(Database: `lab_assistant`, User: `postgres`, Password: `postgrespassword`)*
