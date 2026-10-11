import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useAuth, type Profile } from "./AuthContext";
import "./auth.css";

type Mode = "signin" | "signup" | "reset";
type Fields = { full_name: string; username: string; date_of_birth: string; gender: string; country: string; state: string; city: string; bio: string };
const emptyFields: Fields = { full_name: "", username: "", date_of_birth: "", gender: "", country: "", state: "", city: "", bio: "" };
function fromProfile(p: Profile | null, name = ""): Fields {
  return { full_name: p?.full_name || name, username: p?.username || "", date_of_birth: p?.date_of_birth || "", gender: p?.gender || "", country: p?.country || "", state: p?.state || "", city: p?.city || "", bio: p?.bio || "" };
}
function complete(p: Profile | null) { return Boolean(p?.full_name?.trim() && p.username?.trim() && p.date_of_birth && p.gender?.trim() && p.country?.trim() && p.state?.trim() && p.city?.trim()); }
function ageFromDob(dob: string) { if (!dob) return null; const today = new Date(), birth = new Date(dob + "T12:00:00"); let age = today.getFullYear() - birth.getFullYear(); if (today.getMonth() < birth.getMonth() || (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())) age--; return age >= 0 ? age : null; }

export default function AuthBar() {
  const { user, profile, loading, profileLoading, configured, signInWithGoogle, signUpWithEmail, signInWithEmail, signInWithUsername, resetPassword, saveProfile, signOut } = useAuth();
  const [mode, setMode] = useState<Mode>("signin");
  const [loginType, setLoginType] = useState<"email" | "username">("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fields, setFields] = useState<Fields>(emptyFields);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const isProfileComplete = complete(profile);
  const age = useMemo(() => ageFromDob(fields.date_of_birth), [fields.date_of_birth]);
  useEffect(() => {
    if (user && !editing && fields === emptyFields && !profileLoading) {
      const name = typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name : typeof user.user_metadata?.name === "string" ? user.user_metadata.name : "";
      setFields(fromProfile(profile, name));
    }
  }, [user?.id, profile?.id, profileLoading, editing, fields]);

  function update<K extends keyof Fields>(key: K, value: Fields[K]) { setFields(prev => ({ ...prev, [key]: value })); }
  function showMode(next: Mode) { setMode(next); setMessage(""); setErrorMessage(""); setPassword(""); }
  async function run(action: () => Promise<unknown>) {
    setBusy(true); setMessage(""); setErrorMessage("");
    try { const result = await action(); if (typeof result === "string") setMessage(result); }
    catch (error) { setErrorMessage(error instanceof Error ? error.message : "Something went wrong. Please try again."); }
    finally { setBusy(false); }
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    if (mode === "signup" || (user && !isProfileComplete) || (user && editing)) {
      if (!fields.full_name.trim() || !/^[A-Za-z0-9_]{3,24}$/.test(fields.username) || !fields.date_of_birth || !fields.gender || !fields.country.trim() || !fields.state.trim() || !fields.city.trim()) {
        setErrorMessage("Complete every required field. Username must be 3–24 letters, numbers or underscores."); return;
      }
      const ageNow = ageFromDob(fields.date_of_birth);
      if (ageNow === null) { setErrorMessage("Enter a valid date of birth that is not in the future."); return; }
      const p = { ...fields, username: fields.username.trim() };
      void run(async () => {
        if (mode === "signup" && !user) return await signUpWithEmail(email, password, p);
        await saveProfile(p);
        setEditing(false);
        setMessage("Profile saved.");
      });
      return;
    }
    if (mode === "reset") {
      if (!email.trim()) { setErrorMessage("Enter the email address for your account."); return; }
      void run(async () => { await resetPassword(email); return "If an account uses that email, a password-reset link will be sent."; });
      return;
    }
    if (!password) { setErrorMessage("Enter your password."); return; }
    void run(async () => {
      if (loginType === "username") await signInWithUsername(email, password);
      else await signInWithEmail(email, password);
    });
  }

  if (loading || (user && profileLoading && !profile)) return <div className="account-loading">Communication Lab · {loading ? "Checking your session…" : "Loading your profile…"}</div>;

  if (!configured) return <section className="account-screen"><div className="account-panel"><p className="account-kicker">COMMUNICATION LAB</p><h1>Account setup required</h1><p>Supabase environment variables must be configured before you can sign in or create an account.</p></div></section>;

  if (!user) return (
    <section className="account-screen"><div className="account-panel">
      <p className="account-kicker">COMMUNICATION LAB</p>
      <h1>{mode === "signup" ? "Create your account." : mode === "reset" ? "Reset your password." : "Welcome back."}</h1>
      <p className="account-subtitle">{mode === "signup" ? "Create an account to save your learning progress across devices." : mode === "reset" ? "We'll send password-reset instructions to your email if an account matches." : "Sign in to continue your learning journey."}</p>
      {mode === "signin" && <div className="auth-tabs"><button type="button" className={loginType === "email" ? "selected" : ""} onClick={() => setLoginType("email")}>Email</button><button type="button" className={loginType === "username" ? "selected" : ""} onClick={() => setLoginType("username")}>Username</button></div>}
      <form onSubmit={submit} className="account-form">
        {mode === "signup" && <><label>Full name<input autoComplete="name" value={fields.full_name} onChange={e => update("full_name", e.target.value)} required /></label><label>Username<input autoComplete="username" minLength={3} maxLength={24} pattern="[A-Za-z0-9_]{3,24}" value={fields.username} onChange={e => update("username", e.target.value)} required /><small>3–24 letters, numbers or underscores. Usernames are unique.</small></label></>}
        <label>{mode === "signin" && loginType === "username" ? "Username" : "Email address"}<input type={mode === "signin" && loginType === "username" ? "text" : "email"} autoComplete={mode === "signup" ? "email" : "username"} value={email} onChange={e => setEmail(e.target.value)} required /></label>
        {mode !== "reset" && <label>Password<input type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} minLength={mode === "signup" ? 8 : undefined} value={password} onChange={e => setPassword(e.target.value)} required />{mode === "signup" && <small>Use at least 8 characters.</small>}</label>}
        {mode === "signup" && <ProfileFields fields={fields} update={update} age={age} includeBio={false} />}
        {errorMessage && <p className="account-error" role="alert">{errorMessage}</p>}{message && <p className="account-message" role="status">{message}</p>}
        <button className="account-primary" disabled={busy} type="submit">{busy ? "Please wait…" : mode === "signup" ? "Create account" : mode === "reset" ? "Send reset link" : "Sign in"}</button>
      </form>
      {mode === "signin" && <><div className="account-divider"><span>or</span></div><button className="account-google" disabled={busy} onClick={() => void run(signInWithGoogle)}>Continue with Google</button><button className="account-link" onClick={() => showMode("reset")}>Forgot password?</button><p className="account-switch">New to Communication Lab? <button onClick={() => { setFields(emptyFields); showMode("signup"); }}>Create an account</button></p></>}
      {mode !== "signin" && <p className="account-switch"><button onClick={() => showMode("signin")}>Back to sign in</button></p>}
    </div></section>
  );

  if (!isProfileComplete || editing) {
    const nameFromGoogle = typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name : typeof user.user_metadata?.name === "string" ? user.user_metadata.name : "";
    return <section className="account-screen"><div className="account-panel account-panel-wide">
      <p className="account-kicker">COMPLETE YOUR PROFILE</p><h1>{isProfileComplete ? "Edit your profile." : "A few details first."}</h1>
      <p className="account-subtitle">{isProfileComplete ? "Keep your profile information up to date." : "Please complete every required field before entering your learning workspace."}</p>
      <form onSubmit={submit} className="account-form">
        <label>Email address<input value={user.email || ""} readOnly /></label>
        <ProfileFields fields={fields === emptyFields ? fromProfile(profile, nameFromGoogle) : fields} update={update} age={ageFromDob((fields === emptyFields ? fromProfile(profile, nameFromGoogle) : fields).date_of_birth)} includeUsername={!isProfileComplete} includeBio={isProfileComplete} />
        {errorMessage && <p className="account-error" role="alert">{errorMessage}</p>}{message && <p className="account-message" role="status">{message}</p>}
        <button className="account-primary" type="submit" disabled={busy}>{busy ? "Saving…" : isProfileComplete ? "Save profile" : "Save and continue"}</button>
      </form>
      {isProfileComplete && <button className="account-link" onClick={() => { setEditing(false); setFields(emptyFields); setMessage(""); setErrorMessage(""); }}>Cancel editing</button>}
      <button className="account-link" onClick={() => void run(signOut)}>Sign out</button>
    </div></section>;
  }

  return <section className="auth-bar" aria-label="Account"><div className="auth-bar-copy"><span className="auth-bar-eyebrow">YOUR ACCOUNT</span><div className="auth-bar-identity"><strong>@{profile?.username}</strong></div>{message && <span className="auth-message">{message}</span>}</div><div className="auth-actions"><button type="button" className="auth-button auth-button-secondary" onClick={() => { setFields(fromProfile(profile)); setEditing(true); setMessage(""); setErrorMessage(""); }}><span className="auth-button-icon" aria-hidden="true">✎</span>Edit profile</button><button type="button" className="auth-button auth-button-secondary auth-signout" disabled={busy} onClick={() => void run(signOut)}>{busy ? "Please wait…" : "Sign out"}</button></div></section>;
}

function ProfileFields({ fields, update, age, includeUsername = false, includeBio }: { fields: Fields; update: <K extends keyof Fields>(key: K, value: Fields[K]) => void; age: number | null; includeUsername?: boolean; includeBio: boolean }) {
  const [genderOther, setGenderOther] = useState(false);
  const genders = ["Woman", "Man", "Non-binary", "Prefer to self-describe", "Prefer not to say"];
  return <div className="profile-fields">
    {includeUsername && <label>Username<input autoComplete="username" minLength={3} maxLength={24} pattern="[A-Za-z0-9_]{3,24}" value={fields.username} onChange={e => update("username", e.target.value)} required /><small>3–24 letters, numbers or underscores. Usernames are unique.</small></label>}
    <label>Date of birth<input type="date" max={new Date().toISOString().slice(0,10)} value={fields.date_of_birth} onChange={e => update("date_of_birth", e.target.value)} required />{age !== null && <small>Age: {age}</small>}</label>
    <label>Gender<select value={fields.gender} onChange={e => { update("gender", e.target.value); setGenderOther(e.target.value === "Other"); }} required><option value="">Choose gender</option>{genders.map(g => <option key={g}>{g}</option>)}<option>Other</option></select>{genderOther && <small>Choose “Other” only if none of the listed options fits.</small>}</label>
    <label>Country<input autoComplete="country-name" value={fields.country} onChange={e => update("country", e.target.value)} required /></label>
    <label>State / province<input autoComplete="address-level1" value={fields.state} onChange={e => update("state", e.target.value)} required /></label>
    <label>City<input autoComplete="address-level2" value={fields.city} onChange={e => update("city", e.target.value)} required /></label>
    {includeBio && <label className="profile-bio">Bio <span>(optional)</span><textarea maxLength={500} rows={4} value={fields.bio} onChange={e => update("bio", e.target.value)} placeholder="A little about yourself…" /><small>{fields.bio.length}/500 characters</small></label>}
  </div>;
}
