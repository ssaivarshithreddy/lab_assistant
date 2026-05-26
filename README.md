# LabSense (Supabase Auth + Per-User Isolation)

Production-ready React + Supabase app with:
- Email/password Sign Up, Sign In, Forgot Password
- Session persistence + protected routes
- Secure per-user data model with RLS
- Profile auto-creation on signup

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
  migrations/
    20260526124000_auth_and_rls_hardening.sql
```

## Environment Variables

Create `.env`:

```env
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<anon-public-key>
```

Do not expose the service role key in the frontend.

## Supabase SQL Setup

Run migration:

- `supabase/migrations/20260526124000_auth_and_rls_hardening.sql`

This migration creates:
- `public.profiles`
- trigger `on_auth_user_created` -> auto profile row
- strict RLS policies for `profiles`, `reports`, `chat_messages`, `storage.objects`

## Auth Flow

1. `Sign Up` creates auth user and profile.
2. Active session automatically restores on app load.
3. Protected routes redirect unauthenticated users to `/signin`.
4. Authenticated users are redirected away from `/signin`, `/signup`, `/forgot-password`.

## Per-User Data Rules

- `reports.user_id` is written from authenticated user id.
- Storage files are uploaded under `lab-reports/<user_id>/...`.
- `chat_messages.user_id` is attached for each insert.
- All queries are filtered by authenticated user id.

## Example Per-User Insert Query

```ts
const { user } = useAuth();
await supabase.from("reports").insert({
  user_id: user?.id,
  file_name: file.name,
  values: parsedValues,
});
```

## Run

```bash
npm install
npm run dev
```
