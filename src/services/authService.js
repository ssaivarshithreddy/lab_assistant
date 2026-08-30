import { apiClient, removeToken } from "@/lib/apiClient";

export async function signInWithEmail(email, password) {
  try {
    const res = await apiClient.signIn({ email, password });
    return { data: res, error: null };
  } catch (err) {
    return { data: null, error: err };
  }
}

export async function signUpWithEmail(input) {
  const { fullName, email, password } = input;
  try {
    const res = await apiClient.signUp({ full_name: fullName, email, password });
    return { data: res, error: null };
  } catch (err) {
    return { data: null, error: err };
  }
}

export async function sendPasswordReset(email) {
  try {
    const res = await apiClient.forgotPassword({ email });
    return { data: res, error: null };
  } catch (err) {
    return { data: null, error: err };
  }
}

export async function signOut() {
  removeToken();
  return { error: null };
}

export async function getCurrentSession() {
  try {
    const res = await apiClient.getMe();
    return { data: { session: res ? { user: res.user } : null }, error: null };
  } catch (err) {
    return { data: { session: null }, error: err };
  }
}

export async function signInWithGoogle() {
  alert("Google OAuth is disabled in custom backend mode.");
  return { data: null, error: new Error("Google OAuth disabled") };
}
