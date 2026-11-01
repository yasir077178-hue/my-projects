
/* =========================================================
   YASIR HUB — SUPABASE BACKEND
   Authentication + User Session
========================================================= */

import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

/* =========================================================
   SUPABASE CONNECTION
========================================================= */

const SUPABASE_URL =
    "https://pvjdpppefcwpgwzkbucg.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
    "sb_publishable_MOR8kv7_mU-Slht7uHfV5g_JDGQuS8E";

export const supabase = createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY
);

// Make the client available to budget.js.
window.supabaseClient = supabase;


/* =========================================================
   HTML ELEMENTS
========================================================= */

const $ = (id) => document.getElementById(id);

const authScreen = $("authScreen");
const authForm = $("authForm");
const authTitle = $("authTitle");
const authSubtitle = $("authSubtitle");
const authEmail = $("authEmail");
const authPassword = $("authPassword");
const authSubmit = $("authSubmit");
const authMessage = $("authMessage");
const authSwitch = $("authSwitch");
const authSwitchText = $("authSwitchText");

const signOutButton = $("signOutButton");

let authMode = "login";


/* =========================================================
   AUTH SCREEN DISPLAY
========================================================= */

function showMessage(text, error = false) {
    if (!authMessage) return;

    authMessage.textContent = text;
    authMessage.classList.toggle("error", error);
}

function showLoginScreen() {
    if (authScreen) authScreen.hidden = false;

    document.querySelectorAll(".app").forEach(element => {
        element.hidden = true;
    });
}

function showAppScreen() {
    if (authScreen) authScreen.hidden = true;

    document.querySelectorAll(".app").forEach(element => {
        element.hidden = false;
    });
}


/* =========================================================
   LOGIN / SIGNUP MODE
========================================================= */

function updateAuthMode() {
    if (authTitle) {
        authTitle.textContent =
            authMode === "login" ? "Welcome Back" : "Create Your Account";
    }

    if (authSubtitle) {
        authSubtitle.textContent =
            authMode === "login"
                ? "Login to access your family finance dashboard."
                : "Create your personal YASIR HUB account.";
    }

    if (authSubmit) {
        authSubmit.textContent =
            authMode === "login" ? "Login" : "Create Account";
    }

    if (authSwitchText) {
        authSwitchText.textContent =
            authMode === "login"
                ? "Don't have an account?"
                : "Already have an account?";
    }

    if (authSwitch) {
        authSwitch.textContent =
            authMode === "login" ? "Sign Up" : "Login";
    }

    showMessage("");
}

if (authSwitch) {
    authSwitch.addEventListener("click", () => {
        authMode = authMode === "login" ? "signup" : "login";

        if (authForm) authForm.reset();

        updateAuthMode();
    });
}


/* =========================================================
   AUTH FORM SUBMISSION
========================================================= */

if (authForm) {
    authForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        const email = authEmail?.value.trim();
        const password = authPassword?.value;

        if (!email || !password) {
            showMessage("Please enter your email and password.", true);
            return;
        }

        if (password.length < 6) {
            showMessage("Password must contain at least 6 characters.", true);
            return;
        }

        if (authSubmit) {
            authSubmit.disabled = true;
            authSubmit.textContent = "Please wait...";
        }

        showMessage("");

        try {
            if (authMode === "signup") {

                const { data, error } = await supabase.auth.signUp({
                    email,
                    password
                });

                if (error) throw error;

                if (data.session) {
                    showMessage("Account created successfully!");
                } else {
                    showMessage(
                        "Account created! Check your email and confirm your account before logging in."
                    );
                }

            } else {

                const { data, error } = await supabase.auth.signInWithPassword({
                    email,
                    password
                });

                if (error) throw error;

                if (data.session) {
                    showMessage("Login successful!");
                }
            }

        } catch (error) {
            showMessage(error.message || "Authentication failed.", true);

        } finally {
            if (authSubmit) {
                authSubmit.disabled = false;
                authSubmit.textContent =
                    authMode === "login" ? "Login" : "Create Account";
            }
        }
    });
}


/* =========================================================
   SIGN OUT
========================================================= */

async function signOut() {
    if (!confirm("Are you sure you want to sign out?")) return;

    const { error } = await supabase.auth.signOut();

    if (error) {
        alert("Sign out failed: " + error.message);
    }
}

if (signOutButton) {
    signOutButton.addEventListener("click", signOut);
}


/* =========================================================
   AUTH STATE LISTENER
========================================================= */

supabase.auth.onAuthStateChange((event, session) => {

    if (session?.user) {
        showAppScreen();

        console.log("YASIR HUB user signed in:", session.user.email);

    } else {
        showLoginScreen();

        console.log("YASIR HUB user signed out.");
    }
});


/* =========================================================
   INITIAL SESSION CHECK
========================================================= */

async function checkSession() {
    const { data, error } = await supabase.auth.getSession();

    if (error) {
        console.error("Session error:", error.message);
        showLoginScreen();
        return;
    }

    if (data.session?.user) {
        showAppScreen();
    } else {
        showLoginScreen();
    }
}

updateAuthMode();
checkSession();

console.log("YASIR HUB Supabase backend connected.");
