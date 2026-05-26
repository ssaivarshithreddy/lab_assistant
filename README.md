# LabSense - AI Lab Assistant

## Project Status

LabSense is currently **under development**.

The app is functional for core flows (auth, report upload, analysis, dashboard, assistant), but it is not yet feature-complete and should be treated as an evolving product.

## Overview

LabSense is a full-stack health-tech web application that helps users:

- upload lab/radiology reports (PDF/images),
- extract report text with PDF parsing + OCR,
- generate structured insights,
- view report history and trends,
- ask an AI assistant questions grounded in their own report data,
- keep all report data private per authenticated user.

The platform is built as a modern SaaS-style app using Supabase for authentication, storage, database, and row-level access control.

## Tech Stack

- Frontend: React + TypeScript + Vite
- UI: Tailwind CSS + shadcn/ui + Radix
- Routing: React Router
- Data fetching/state: TanStack Query
- Backend services: Supabase (Auth, Postgres, Storage, Edge Functions)
- OCR/Text extraction:
  - `pdfjs-dist` for PDF text extraction
  - `tesseract.js` for OCR fallback

## Core Features (Current)

- Email/password authentication (Sign Up, Sign In, Forgot Password)
- Google sign-in support (requires Supabase provider setup)
- Session persistence and route protection
- User profile auto-creation (`profiles` table)
- Report upload and secure storage pathing per user
- Report analysis pipeline (deterministic parsing + optional model enrichment)
- Dashboard with metric cards, summary, risks, and trend chart
- AI assistant with cloud mode + robust local fallback responses
- AI connectivity diagnostics tool

## Architecture Summary

### Frontend layers

- `src/features/auth`: auth provider and route guards
- `src/services`: service-level integrations (auth service)
- `src/pages`: screen-level UI and page flows
- `src/lib`: analysis, OCR, helpers, local fallbacks
- `src/integrations/supabase`: Supabase client and generated DB types

### Backend/Data layers

- Supabase Postgres tables:
  - `profiles`
  - `reports`
  - `chat_messages`
- Supabase Storage:
  - `lab-reports` bucket (user-folder scoped)
- Supabase Edge Functions:
  - `chat-assistant`
  - `analyze-report` (available, optional path)

## Folder Structure

```text
src/
  components/
  features/
    auth/
      AuthProvider.tsx
      ProtectedRoute.tsx
      PublicOnlyRoute.tsx
  integrations/
    supabase/
      client.ts
      types.ts
  lib/
    analyzeReport.ts
    extractText.ts
    aiConnectivity.ts
    localReports.ts
  pages/
    auth/
      AuthShell.tsx
      SignIn.tsx
      SignUp.tsx
      ForgotPassword.tsx
    Upload.tsx
    Dashboard.tsx
    Assistant.tsx
  services/
    authService.ts
supabase/
  functions/
  migrations/
```

## Application Requirements

### Runtime

- Node.js 18+ (recommended 20+)
- npm 9+

### External services

- Supabase project with:
  - Auth enabled
  - Postgres database
  - Storage bucket (`lab-reports`)
  - Required SQL migrations applied

### Optional provider config

- Google OAuth in Supabase (for Google sign-in)
- Hugging Face/OpenAI gateway creds if using remote model enrichment

## Environment Variables

Create `.env` in project root:

```env
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<supabase-anon-key>

# Optional AI settings
VITE_AI_GATEWAY_URL=
VITE_AI_GATEWAY_KEY=
VITE_FORCE_LOCAL_MODE=false
VITE_USE_EDGE_FUNCTION=false
VITE_USE_SUPABASE_FUNCTION=false
```

Security note:
- Use only Supabase anon key on frontend.
- Never expose service role key in client code.

## Database & Security Setup

Apply migrations from `supabase/migrations/`.

Important migration:
- `20260526124000_auth_and_rls_hardening.sql`

This includes:
- `profiles` table creation
- trigger to auto-create profile on signup
- strict RLS policies for `profiles`, `reports`, `chat_messages`
- storage policies for user-isolated report files

## Authentication Flow

### Signup flow

1. User enters name, email, password.
2. Supabase Auth account is created.
3. Profile row is auto-created in `profiles` via trigger.
4. User is redirected to app home (or email verification path depending on auth settings).

### Signin flow

1. User signs in with email/password or Google.
2. Session is persisted in browser storage.
3. App auto-restores session on refresh.

### Protected routes

- Unauthenticated users are redirected to `/signin`.
- Authenticated users are redirected away from public auth pages.

## Application Flow

1. **Authenticate**
   - User logs in or signs up.

2. **Upload report**
   - User uploads PDF/image.
   - Text extraction runs:
     - PDF text extraction first
     - OCR fallback if needed

3. **Analyze**
   - Deterministic parser extracts metrics when applicable.
   - Radiology narrative handling path for non-tabular reports.
   - Optional model enrichment attempts.

4. **Persist per-user**
   - Report row saved with `user_id`.
   - File stored under `lab-reports/<user_id>/...`.

5. **Dashboard**
   - User sees only their own reports and metrics.
   - Risk summary and trend visualization shown.

6. **Assistant**
   - User asks report-specific questions.
   - Cloud assistant path if available.
   - Local grounded fallback if provider/network unavailable.

## Installation

```bash
npm install
```

## Running Commands

### Development

```bash
npm run dev
```

### Build

```bash
npm run build
```

### Preview production build

```bash
npm run preview
```

### Lint

```bash
npm run lint
```

### Tests

```bash
npm run test
```

## Supabase Setup Checklist

1. Set project URL + anon key in `.env`.
2. Apply migrations.
3. Verify `lab-reports` bucket exists.
4. Ensure RLS policies are active.
5. Enable Google provider (if using Google login).
6. Deploy edge functions (if using cloud assistant/analyzer paths).

## Current Limitations (Under Development)

- Some report formats still need parser tuning.
- AI provider availability (DNS/token/provider config) can affect enrichment.
- Assistant cloud behavior depends on edge function + upstream model health.
- Additional validation and domain-specific parser coverage are in progress.

## Notes for Contributors

- Keep auth and data ownership strict (`user_id` on all user-generated records).
- Do not bypass RLS in client code.
- Preserve local fallback behavior for resilience when cloud AI is unavailable.
