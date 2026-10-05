// Email + password sign-in with Supabase Auth. The game stays hidden until a
// user is signed in; app.js listens for the "auth-change" event.
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "./config.js";

// Loaded as a classic script from vendor/ before this module runs.
const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

const el = {
  form: document.getElementById("auth-form"),
  email: document.getElementById("auth-email"),
  password: document.getElementById("auth-password"),
  submit: document.getElementById("auth-submit"),
  title: document.getElementById("auth-title"),
  toggle: document.getElementById("auth-toggle"),
  togglePrompt: document.getElementById("auth-toggle-prompt"),
  message: document.getElementById("auth-message"),
  userEmail: document.getElementById("user-email"),
  signOut: document.getElementById("sign-out-btn"),
};

let mode = "sign-in"; // or "sign-up"

function setMode(next) {
  mode = next;
  const signUp = mode === "sign-up";
  el.title.textContent = signUp ? "Create your account" : "Sign in to play";
  el.submit.textContent = signUp ? "Create account" : "Sign in";
  el.togglePrompt.textContent = signUp ? "Already have an account?" : "New here?";
  el.toggle.textContent = signUp ? "Sign in" : "Create an account";
  el.password.autocomplete = signUp ? "new-password" : "current-password";
  showMessage("");
}

function showMessage(text, tone = "error") {
  el.message.textContent = text;
  el.message.dataset.tone = tone;
}

function applySession(session) {
  const user = session?.user ?? null;
  document.body.dataset.auth = user ? "signed-in" : "signed-out";
  el.userEmail.textContent = user?.email ?? "";
  document.dispatchEvent(new CustomEvent("auth-change", { detail: { user } }));
}

async function handleSubmit(event) {
  event.preventDefault();
  const email = el.email.value.trim();
  const password = el.password.value;
  el.submit.disabled = true;
  showMessage("");

  try {
    if (mode === "sign-up") {
      const { data, error } = await client.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: window.location.origin },
      });
      if (error) throw error;
      if (!data.session) {
        // Email confirmation is turned on in Supabase.
        setMode("sign-in");
        showMessage("Check your inbox for a confirmation link, then sign in.", "info");
        return;
      }
    } else {
      const { error } = await client.auth.signInWithPassword({ email, password });
      if (error) throw error;
    }
    el.form.reset();
  } catch (error) {
    showMessage(friendlyError(error));
  } finally {
    el.submit.disabled = false;
  }
}

function friendlyError(error) {
  const msg = error?.message ?? String(error);
  if (/invalid login credentials/i.test(msg)) return "Wrong email or password.";
  if (/email not confirmed/i.test(msg)) return "Please confirm your email first (check your inbox).";
  if (/already registered/i.test(msg)) return "That email already has an account. Try signing in.";
  if (/failed to fetch|network/i.test(msg)) return "Can't reach the login server. Check your connection.";
  return msg;
}

el.form.addEventListener("submit", handleSubmit);
el.toggle.addEventListener("click", () => setMode(mode === "sign-in" ? "sign-up" : "sign-in"));
el.signOut.addEventListener("click", async () => {
  await client.auth.signOut();
});

// Fires once on load with the saved session (if any), then on every change.
client.auth.onAuthStateChange((_event, session) => {
  // Defer so we never call back into Supabase from inside its own callback.
  setTimeout(() => applySession(session), 0);
});

setMode("sign-in");
