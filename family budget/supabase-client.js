
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

// Keep the same project URL and publishable key
// that you already used successfully.
const SUPABASE_URL = "https://pvjdpppefcwpgwzkbucg.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_MOR8kv7_mU-Slht7uHfV5g_JDGQuS8E";

const supabase = createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY
);

window.supabaseClient = supabase;

const authScreen = document.getElementById("authScreen");
const authForm = document.getElementById("authForm");
const authEmail = document.getElementById("authEmail");
const authPassword = document.getElementById("authPassword");
const authTitle = document.getElementById("authTitle");
const authSubtitle = document.getElementById("authSubtitle");
const authSubmit = document.getElementById("authSubmit");
const authMessage = document.getElementById("authMessage");
const authSwitch = document.getElementById("authSwitch");
const authSwitchText = document.getElementById("authSwitchText");
const signOutButton = document.getElementById("signOutButton");

let authMode = "login";
let authBusy = false;

function showAuthMessage(message, isError = false) {
    authMessage.textContent = message;
    authMessage.classList.toggle("error", isError);
}

function setAuthMode(mode) {
    authMode = mode;

    const signingUp = mode === "signup";

    authTitle.textContent = signingUp
        ? "Create your account"
        : "Welcome back";

    authSubtitle.textContent = signingUp
        ? "Create an account to manage your family finances."
        : "Sign in to access your Family Budget dashboard.";

    authSubmit.textContent = signingUp
        ? "Create Account"
        : "Sign In";

    authPassword.autocomplete = signingUp
        ? "new-password"
        : "current-password";

    authSwitchText.textContent = signingUp
        ? "Already have an account?"
        : "New to YASIR HUB?";

    authSwitch.textContent = signingUp
        ? "Sign in"
        : "Create account";

    showAuthMessage("");
}

function showSignedInState(user) {
    authScreen.hidden = true;
    document.querySelector(".app").hidden = false;

    if (signOutButton) {
        signOutButton.hidden = false;
    }

    console.log("Signed in:", user.email);
}

function showSignedOutState() {
    authScreen.hidden = false;
    document.querySelector(".app").hidden = true;

    if (signOutButton) {
        signOutButton.hidden = true;
    }

    authPassword.value = "";
    setAuthMode("login");
}

authSwitch.addEventListener("click", () => {
    setAuthMode(authMode === "login" ? "signup" : "login");
});

authForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (authBusy) return;

    const email = authEmail.value.trim();
    const password = authPassword.value;

    if (!email || !password) {
        showAuthMessage("Enter your email and password.", true);
        return;
    }

    authBusy = true;
    authSubmit.disabled = true;
    authSubmit.textContent = authMode === "signup"
        ? "Creating account..."
        : "Signing in...";

    showAuthMessage("");

    try {
        if (authMode === "signup") {
            const { data, error } = await supabase.auth.signUp({
                email,
                password
            });

            if (error) throw error;

            if (data.session) {
                showSignedInState(data.user);
            } else {
                showAuthMessage(
                    "Account created! Check your email to confirm your account, then sign in."
                );
                setAuthMode("login");
            }
        } else {
            const { data, error } =
                await supabase.auth.signInWithPassword({
                    email,
                    password
                });

            if (error) throw error;

            showSignedInState(data.user);
        }
    } catch (error) {
        showAuthMessage(error.message || "Authentication failed.", true);
    } finally {
        authBusy = false;
        authSubmit.disabled = false;
        authSubmit.textContent = authMode === "signup"
            ? "Create Account"
            : "Sign In";
    }
});

if (signOutButton) {
    signOutButton.addEventListener("click", async () => {
        signOutButton.disabled = true;

        const { error } = await supabase.auth.signOut();

        signOutButton.disabled = false;

        if (error) {
            alert("Could not sign out: " + error.message);
            return;
        }

        showSignedOutState();
    });
}

// Restore the existing Supabase session after a page refresh.
async function initialiseAuth() {
    authScreen.hidden = false;
    document.querySelector(".app").hidden = true;

    try {
        const { data, error } = await supabase.auth.getSession();

        if (error) throw error;

        if (data.session) {
            showSignedInState(data.session.user);
        } else {
            showSignedOutState();
        }
    } catch (error) {
        showAuthMessage(
            "Could not connect to Supabase. Check your project URL and publishable key.",
            true
        );
        console.error("Supabase authentication error:", error);
    }
}

supabase.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_OUT" || !session) {
        showSignedOutState();
    } else if (event === "SIGNED_IN" || event === "INITIAL_SESSION") {
        showSignedInState(session.user);
    }
});

setAuthMode("login");
initialiseAuth();
