# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

React 18, Vite, Tailwind CSS, shadcn/ui, Lucide React, Recharts, TanStack Query (Frontend); Node.js, Express, PostgreSQL, MinIO, Groq API (Backend).

## Users

Dual usage: both patients/individuals seeking clear understanding of their lab reports and clinical practitioners needing rapid parameter triage & RAG-assisted medical reasoning.

## Product Purpose

LabSense is a full-stack health-tech web application designed for comprehensive lab report analysis (PDF/images), deterministic parameter validation, 4-step clinical rationale processing, RAG-assisted medical reasoning, and object storage management.

## Positioning

Uniquely combines deterministic clinical rule engine validation (CBC, LFT, KFT, Glycemic, and Lipid panels) with a structured 4-step medical rationale chain and dual-source RAG searching both curated medical knowledge and historical user reports.

## Operating Context

Desktop and mobile web browser environment where users upload lab documents (PDFs, scans), inspect parameter breakdowns, consult an AI assistant, and manage vector/object storage.

## Capabilities and Constraints

- Capabilities: PDF text extraction + Tesseract OCR fallback, deterministic parameter extraction & clinical validation, 4-step medical rationale chain, dual-source RAG assistant, MinIO object storage, admin PostgreSQL table inspector & query runner.
- Constraints: Must preserve existing React 18 / Vite / Tailwind CSS / shadcn/ui frontend foundation and Express / Postgres / MinIO backend architecture.

## Brand Commitments

- Product Name: LabSense - AI Lab Assistant
- UI Aesthetics: Clean, clinical, trustworthy health-tech interface powered by Tailwind CSS, shadcn/ui components, and Lucide React icons.

## Evidence on Hand

- Existing full-stack codebase with frontend (`src/`), Express server (`server/`), database schema (`server/schema.sql`, `create_profiles.sql`), and sample files (`samples/`).
- Fully containerized setup via `docker-compose.yml`.

## Product Principles

1. Clinical Integrity & Deterministic Precision: Validate extracted health parameters with clinical rules before AI reasoning.
2. Clarity for Patients, Rigor for Clinicians: Deliver accessible, readable breakdowns for individuals alongside multi-step pathophysiological rationale for practitioners.
3. Integrated Health Workspace: Provide a seamless workflow connecting report ingestion, interactive AI consultation, and administrative storage oversight.

## Accessibility & Inclusion

Accessible web interface adhering to WCAG AA guidelines with high-contrast health status badges (normal/abnormal triage tags), responsive touch targets, and clear typographic hierarchy.
