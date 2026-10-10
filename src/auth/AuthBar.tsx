import { useState } from "react";
import { useAuth } from "./AuthContext";
import "./auth.css";

export default function AuthBar() {
  const { user, loading, configured, signInWithGoogle, signOut } = useAuth();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setMessage("");
    try {
      await action();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Authentication failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="auth-bar" aria-label="Account">
      <div className="auth-bar-copy">
        <strong>{user ? "Signed in with Google" : "Your account"}</strong>
        <span>
          {loading
            ? "Checking session…"
            : user
              ? user.email ?? "Google account connected"
              : configured
                ? "Sign in to prepare your account for cloud sync"
                : "Authentication setup required"}
        </span>
        {message && <span className="auth-message" role="alert">{message}</span>}
        {!configured && !loading && (
          <span className="auth-help">
            Configure the Supabase environment variables to enable Google sign-in.
          </span>
        )}
        {user && (
          <span className="auth-local-note">
            Cloud sync is not enabled yet. Learning data is still saved on this device.
          </span>
        )}
      </div>
      {user ? (
        <button
          className="auth-button auth-button-secondary"
          type="button"
          disabled={busy || loading}
          onClick={() => void run(signOut)}
        >
          {busy ? "Please wait…" : "Sign out"}
        </button>
      ) : (
        <button
          className="auth-button"
          type="button"
          disabled={busy || loading || !configured}
          onClick={() => void run(signInWithGoogle)}
        >
          {busy ? "Connecting…" : "Continue with Google"}
        </button>
      )}
    </section>
  );
}
