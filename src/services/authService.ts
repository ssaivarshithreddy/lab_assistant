import { supabase } from "@/integrations/supabase/client";

export async function signInWithEmail(email: string, password: string) {
  return supabase.auth.signInWithPassword({ email, password });
}

export async function signUpWithEmail(input: {
  fullName: string;
  email: string;
  password: string;
}) {
  const { fullName, email, password } = input;
  const result = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
      },
      emailRedirectTo: `${window.location.origin}/`,
    },
  });

  // Trigger-based profile creation is primary. This upsert is a safe fallback.
  if (result.data.user) {
    await supabase.from("profiles").upsert({
      id: result.data.user.id,
      full_name: fullName,
      email,
    });
  }

  return result;
}

export async function sendPasswordReset(email: string) {
  return supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/signin`,
  });
}

export async function signOut() {
  return supabase.auth.signOut();
}

export async function getCurrentSession() {
  return supabase.auth.getSession();
}

export async function signInWithGoogle() {
  return supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${window.location.origin}/`,
    },
  });
}
