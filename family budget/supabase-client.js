
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const SUPABASE_URL = "https://pvjdpppefcwpgwzkbucg.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_MOR8kv7_mU-Slht7uHfV5g_JDGQuS8E";
const REDIRECT_URL = "yasirhub://auth/callback";

const supabase = createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY,
    {
        auth: {
            flowType: "implicit",
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: false
        }
    }
);

window.supabaseClient = supabase;

const $ = id => document.getElementById(id);

let busy = false;
let currentEmail = "";

const authSteps = [
    "signInStep",
    "signUpStep",
    "forgotPasswordStep",
    "verificationStep",
    "setupPinStep",
    "unlockPinStep"
];

function showMessage(message = "", error = false) {
    const el = $("authMessage");
    if (!el) return;

    el.textContent = message;
    el.classList.toggle("error", error);
}

function showStep(step) {
    authSteps.forEach(id => {
        if ($(id)) $(id).hidden = id !== step;
    });

    $("authScreen").hidden = false;
    document.querySelector(".app").hidden = true;
    showMessage();
}

function setBusy(id, state, text) {
    const button = $(id);
    if (!button) return;

    if (!button.dataset.originalText) {
        button.dataset.originalText = button.textContent;
    }

    button.disabled = state;
    button.textContent = state ? text : button.dataset.originalText;
}

function showUnlockedApp(user) {
    $("authScreen").hidden = true;
    document.querySelector(".app").hidden = false;

    window.dispatchEvent(new CustomEvent(
        "familyFinanceUnlocked",
        { detail: { user } }
    ));
}

async function checkSession() {
    const { data, error } = await supabase.auth.getSession();

    if (error) {
        showStep("signInStep");
        showMessage(error.message, true);
        return;
    }

    const user = data.session?.user;

    if (!user || !user.email_confirmed_at) {
        showStep("signInStep");
        return;
    }

    const { data: hasPin, error: pinError } =
        await supabase.rpc("has_family_pin");

    if (pinError) {
        showStep("signInStep");
        showMessage(pinError.message, true);
        return;
    }

    showStep(hasPin ? "unlockPinStep" : "setupPinStep");
}

/* CREATE ACCOUNT */

$("signUpForm").addEventListener("submit", async event => {
    event.preventDefault();
    if (busy) return;

    const email = $("signUpEmail").value.trim().toLowerCase();
    const password = $("signUpPassword").value;
    const confirm = $("confirmPassword").value;

    if (password.length < 8) {
        showMessage("Password must contain at least 8 characters.", true);
        return;
    }

    if (password !== confirm) {
        showMessage("Passwords do not match.", true);
        return;
    }

    busy = true;
    setBusy("signUpSubmit", true, "Creating account...");

    try {
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                emailRedirectTo: REDIRECT_URL
            }
        });

        if (error) throw error;

        currentEmail = email;

        if (data.session) {
            await checkSession();
        } else {
            showStep("verificationStep");
            showMessage("Check your email to verify your account.");
        }
    } catch (error) {
        showMessage(error.message, true);
    } finally {
        busy = false;
        setBusy("signUpSubmit", false);
    }
});

/* SIGN IN */

$("signInForm").addEventListener("submit", async event => {
    event.preventDefault();
    if (busy) return;

    const email = $("authEmail").value.trim().toLowerCase();
    const password = $("authPassword").value;

    busy = true;
    setBusy("signInSubmit", true, "Signing in...");

    try {
        const { error } = await supabase.auth.signInWithPassword({
            email,
            password
        });

        if (error) throw error;

        await checkSession();
    } catch (error) {
        showMessage(error.message, true);
    } finally {
        busy = false;
        setBusy("signInSubmit", false);
    }
});

/* FORGOT PASSWORD */

$("forgotPasswordForm").addEventListener("submit", async event => {
    event.preventDefault();

    const email = $("resetEmail").value.trim().toLowerCase();

    setBusy("resetPasswordSubmit", true, "Sending...");

    try {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: REDIRECT_URL
        });

        if (error) throw error;

        showMessage("If the account exists, a password reset email has been sent.");
    } catch (error) {
        showMessage(error.message, true);
    } finally {
        setBusy("resetPasswordSubmit", false);
    }
});

/* NAVIGATION */

$("createAccountLink").addEventListener("click", event => {
    event.preventDefault();
    showStep("signUpStep");
});

$("backToSignIn").addEventListener("click", event => {
    event.preventDefault();
    showStep("signInStep");
});

$("forgotPasswordLink").addEventListener("click", event => {
    event.preventDefault();
    showStep("forgotPasswordStep");
});

$("backFromForgotPassword").addEventListener("click", event => {
    event.preventDefault();
    showStep("signInStep");
});

/* RESEND VERIFICATION */

$("resendEmail").addEventListener("click", async () => {
    if (!currentEmail) {
        showStep("signUpStep");
        return;
    }

    setBusy("resendEmail", true, "Sending...");

    try {
        const { error } = await supabase.auth.resend({
            type: "signup",
            email: currentEmail,
            options: { emailRedirectTo: REDIRECT_URL }
        });

        if (error) throw error;
        showMessage("Verification email sent again.");
    } catch (error) {
        showMessage(error.message, true);
    } finally {
        setBusy("resendEmail", false);
    }
});

/* CREATE PIN */

$("setupPinForm").addEventListener("submit", async event => {
    event.preventDefault();

    const pin = $("newPin").value;
    const confirm = $("confirmPin").value;

    if (!/^\d{4}$/.test(pin)) {
        showMessage("Enter exactly 4 digits.", true);
        return;
    }

    if (pin !== confirm) {
        showMessage("PINs do not match.", true);
        return;
    }

    setBusy("setupPinSubmit", true, "Saving...");

    try {
        const { error } = await supabase.rpc("set_family_pin", {
            p_pin: pin
        });

        if (error) throw error;

        $("setupPinForm").reset();

        const { data } = await supabase.auth.getUser();
        showUnlockedApp(data.user);
    } catch (error) {
        showMessage(error.message, true);
    } finally {
        setBusy("setupPinSubmit", false);
    }
});

/* UNLOCK WITH PIN */

$("unlockPinForm").addEventListener("submit", async event => {
    event.preventDefault();

    const pin = $("loginPin").value;

    if (!/^\d{4}$/.test(pin)) {
        showMessage("Enter your 4-digit PIN.", true);
        return;
    }

    setBusy("unlockPinSubmit", true, "Checking...");

    try {
        const { data, error } = await supabase.rpc("verify_family_pin", {
            p_pin: pin
        });

        if (error) throw error;

        if (data !== true) {
            $("loginPin").value = "";
            showMessage("Incorrect PIN. Try again.", true);
            return;
        }

        $("unlockPinForm").reset();

        const { data: userData, error: userError } =
            await supabase.auth.getUser();

        if (userError) throw userError;

        showUnlockedApp(userData.user);
    } catch (error) {
        showMessage(error.message, true);
    } finally {
        setBusy("unlockPinSubmit", false);
    }
});

/* SIGN OUT */

async function signOut() {
    if (!confirm("Are you sure you want to sign out?")) return;

    const { error } = await supabase.auth.signOut();

    if (error) {
        showMessage(error.message, true);
    }
}

$("signOutButton")?.addEventListener("click", signOut);
$("settingsSignOut")?.addEventListener("click", signOut);

/* ELECTRON CALLBACK */

async function handleDesktopAuthCallback(callbackUrl) {
    try {
        const url = new URL(callbackUrl);

        if (url.protocol !== "yasirhub:" ||
            url.hostname !== "auth" ||
            url.pathname !== "/callback") return;

        const params = new URLSearchParams(url.hash.substring(1));

        const accessToken = params.get("access_token");
        const refreshToken = params.get("refresh_token");

        if (!accessToken || !refreshToken) {
            showMessage("Verification link did not return a session. Please check the link.", true);
            return;
        }

        const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken
        });

        if (error) throw error;

        await checkSession();
    } catch (error) {
        showMessage(error.message, true);
    }
}

window.addEventListener("desktopAuthCallback", event => {
    handleDesktopAuthCallback(event.detail);
});

if (window.desktopAuth) {
    window.desktopAuth.onCallback(url => {
        window.dispatchEvent(
            new CustomEvent("desktopAuthCallback", { detail: url })
        );
    });
}

supabase.auth.onAuthStateChange(event => {
    if (event === "SIGNED_OUT") {
        showStep("signInStep");
        window.dispatchEvent(new CustomEvent("familyFinanceLocked"));
    }
});

showStep("signInStep");
checkSession();

console.log("YASIR HUB authentication ready.");
