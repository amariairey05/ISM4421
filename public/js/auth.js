// Google and email + password sign-in with Supabase Auth. The game stays hidden until a
// user is signed in; app.js listens for the "auth-change" event.
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "./config.js";

// Read before the client starts: Supabase tidies the URL after a Google redirect.
const redirectParams = new URLSearchParams(window.location.hash.slice(1) || window.location.search);

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
  google: document.getElementById("google-btn"),
  avatarImg: document.getElementById("avatar-img"),
  avatarInitial: document.getElementById("avatar-initial"),
  playerName: document.getElementById("player-name"),
  signOut: document.getElementById("sign-out-btn"),
};

let mode = "sign-in"; // or "sign-up"

function setMode(next) {
  mode = next;
  const signUp = mode === "sign-up";
  el.title.textContent = signUp ? "Create your account" : "Sign in to play";
  el.submit.textContent = signUp ? "CREATE ACCOUNT" : "SIGN IN";
  el.togglePrompt.textContent = signUp ? "Have an account?" : "New here?";
  el.toggle.textContent = signUp ? "Sign in" : "Create an account";
  el.password.autocomplete = signUp ? "new-password" : "current-password";
  showMessage("");
}

function showMessage(text, tone = "error") {
  el.message.textContent = text;
  el.message.dataset.tone = tone;
}

/** Display name and picture. Google fills user_metadata; email users get their email. */
function profile(user) {
  const meta = user?.user_metadata ?? {};
  const name = meta.full_name || meta.name || user?.email?.split("@")[0] || "Player";
  const picture = meta.avatar_url || meta.picture || "";
  return { name, picture: /^https:\/\//.test(picture) ? picture : "" };
}

function showProfile(user) {
  const { name, picture } = profile(user);
  el.playerName.textContent = user ? name : "";
  el.playerName.title = user?.email ?? "";
  el.avatarInitial.textContent = name.charAt(0).toUpperCase();
  el.avatarInitial.hidden = Boolean(picture);
  el.avatarImg.hidden = !picture;
  if (picture) el.avatarImg.src = picture;
  else el.avatarImg.removeAttribute("src");
}

// If the picture can't load, fall back to the initial.
el.avatarImg.addEventListener("error", () => {
  el.avatarImg.hidden = true;
  el.avatarInitial.hidden = false;
});

function applySession(session) {
  const user = session?.user ?? null;
  document.body.dataset.auth = user ? "signed-in" : "signed-out";
  showProfile(user);
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

/** True when the Google provider is switched on in the Supabase dashboard. */
async function googleEnabled() {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/settings`, {
    headers: { apikey: SUPABASE_PUBLISHABLE_KEY },
  });
  if (!response.ok) throw new Error(`Supabase settings error (${response.status})`);
  const settings = await response.json();
  return Boolean(settings.external?.google);
}

async function signInWithGoogle() {
  el.google.disabled = true;
  showMessage("");
  try {
    // Without this check a disabled provider shows a raw JSON error page.
    if (!(await googleEnabled())) throw new Error("provider is not enabled");
    // Leaves the page for Google; Supabase sends the user back here signed in.
    const { error } = await client.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin + window.location.pathname },
    });
    if (error) throw error;
  } catch (error) {
    showMessage(friendlyError(error));
    el.google.disabled = false;
  }
}

/** Shows an error Supabase or Google sent back in the redirect URL, then tidies the URL. */
function showRedirectError() {
  const error = redirectParams.get("error_description") || redirectParams.get("error");
  if (!error) return;
  showMessage(friendlyError(new Error(error)));
  history.replaceState(null, "", window.location.pathname);
}

function friendlyError(error) {
  const msg = error?.message ?? String(error);
  if (/provider is not enabled|unsupported provider/i.test(msg)) {
    return "Google sign-in isn't turned on yet. Use email for now.";
  }
  if (/access_denied|cancel/i.test(msg)) return "Google sign-in was cancelled.";
  if (/invalid login credentials/i.test(msg)) return "Wrong email or password.";
  if (/email not confirmed/i.test(msg)) return "Please confirm your email first (check your inbox).";
  if (/already registered/i.test(msg)) return "That email already has an account. Try signing in.";
  if (/failed to fetch|network|load failed/i.test(msg)) {
    return "Can't reach the login server right now. Please try again in a minute.";
  }
  return msg;
}

el.form.addEventListener("submit", handleSubmit);
el.google.addEventListener("click", signInWithGoogle);
// Coming back with the browser's Back button restores the page as it was left.
window.addEventListener("pageshow", (event) => {
  if (event.persisted) el.google.disabled = false;
});
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
showRedirectError();
