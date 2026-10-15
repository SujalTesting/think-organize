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
  const { user, profile, loading, profileLoading, configured, signInWithGoogle, signUpWithEmail, signInWithEmail, signInWithUsername, resetPassword, updatePassword, recoveryMode, saveProfile, signOut } = useAuth();
  const [mode, setMode] = useState<Mode>("signin");
  const [loginType, setLoginType] = useState<"email" | "username">("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fields, setFields] = useState<Fields>(emptyFields);
  const [editing, setEditing] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
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
    if (recoveryMode) {
      if (newPassword.length < 8) { setErrorMessage("Use at least 8 characters for your new password."); return; }
      if (newPassword !== confirmPassword) { setErrorMessage("The passwords do not match."); return; }
      void run(async () => { await updatePassword(newPassword); setNewPassword(""); setConfirmPassword(""); return "Password updated. You can continue using Communication Lab."; });
      return;
    }
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

  if (recoveryMode) return <section className="account-screen"><div className="account-panel"><p className="account-kicker">COMMUNICATION LAB</p><h1>Choose a new password.</h1><p className="account-subtitle">Enter and confirm your new password to finish resetting your account.</p><form onSubmit={submit} className="account-form"><label>New password<input type="password" autoComplete="new-password" minLength={8} value={newPassword} onChange={e => setNewPassword(e.target.value)} required /><small>Use at least 8 characters.</small></label><label>Confirm new password<input type="password" autoComplete="new-password" minLength={8} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required /></label>{errorMessage && <p className="account-error" role="alert">{errorMessage}</p>}{message && <p className="account-message" role="status">{message}</p>}<button className="account-primary" disabled={busy} type="submit">{busy ? "Updating…" : "Update password"}</button></form></div></section>;

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

  if (user && profileOpen && !editing) {
    const rows: [string, string][] = [
      ["Full name", profile?.full_name || "Not set"],
      ["Username", profile?.username || "Not set"],
      ["Email", user.email || "Not available"],
      ["Date of birth", profile?.date_of_birth || "Not set"],
      ["Gender", profile?.gender || "Not set"],
      ["Country", profile?.country || "Not set"],
      ["State / province", profile?.state || "Not set"],
      ["City", profile?.city || "Not set"],
    ];
    return <section className="account-screen account-edit-overlay"><div className="account-panel account-panel-wide profile-view-panel">
      <p className="account-kicker">YOUR ACCOUNT</p><h1>Your profile.</h1><p className="account-subtitle">Review your account details and keep your information up to date.</p>
      <div className="profile-view-grid">{rows.map(([label, value]) => <div className="profile-view-field" key={label}><span>{label}</span><strong>{value}</strong></div>)}{profile?.bio?.trim() && <div className="profile-view-field profile-view-bio"><span>Bio</span><strong>{profile.bio}</strong></div>}</div>
      <button className="account-primary profile-edit-action" onClick={() => { setFields(fromProfile(profile)); setEditing(true); setProfileOpen(false); setMessage(""); setErrorMessage(""); }}>Edit profile</button>
      <button className="account-link" onClick={() => setProfileOpen(false)}>Close profile</button>
    </div></section>;
  }

  if (!isProfileComplete || editing) {
    const nameFromGoogle = typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name : typeof user.user_metadata?.name === "string" ? user.user_metadata.name : "";
    return <section className="account-screen account-edit-overlay"><div className="account-panel account-panel-wide">
      <p className="account-kicker">COMPLETE YOUR PROFILE</p><h1>{isProfileComplete ? "Edit your profile." : "A few details first."}</h1>
      <p className="account-subtitle">{isProfileComplete ? "Keep your profile information up to date." : "Please complete every required field before entering your learning workspace."}</p>
      <form onSubmit={submit} className="account-form">
        <label>Email address<input value={user.email || ""} readOnly /></label>
        <label>Full name<input autoComplete="name" value={fields.full_name || nameFromGoogle} onChange={e => update("full_name", e.target.value)} required /></label>
        <ProfileFields fields={fields === emptyFields ? fromProfile(profile, nameFromGoogle) : fields} update={update} age={ageFromDob((fields === emptyFields ? fromProfile(profile, nameFromGoogle) : fields).date_of_birth)} includeUsername={!isProfileComplete} includeBio={isProfileComplete} />
        {errorMessage && <p className="account-error" role="alert">{errorMessage}</p>}{message && <p className="account-message" role="status">{message}</p>}
        <button className="account-primary" type="submit" disabled={busy}>{busy ? "Saving…" : isProfileComplete ? "Save profile" : "Save and continue"}</button>
      </form>
      {isProfileComplete && <button className="account-link" onClick={() => { setEditing(false); setFields(emptyFields); setMessage(""); setErrorMessage(""); }}>Cancel editing</button>}
      <button className="account-link" onClick={() => void run(signOut)}>Sign out</button>
    </div></section>;
  }

  return <section className="auth-bar" aria-label="Account"><div className="workspace-brand-lockup"><div className="workspace-brand-mark" aria-hidden="true"><svg viewBox="0 0 32 32"><path d="M16 4.5 25.5 10v12L16 27.5 6.5 22V10z" fill="none" stroke="currentColor" strokeWidth="1.6"/><circle cx="16" cy="16" r="3.2" fill="currentColor"/><circle cx="16" cy="7.5" r="1.5" fill="#b8d4a9"/><circle cx="23.3" cy="20.2" r="1.5" fill="#b8d4a9"/><circle cx="8.7" cy="20.2" r="1.5" fill="#b8d4a9"/></svg></div><div><strong>GenAI Learning Lab</strong><small>Learn · Build · Evaluate</small></div></div><div className="auth-menu-wrap"><button type="button" className="auth-settings-button" aria-label="Account settings" aria-expanded={accountMenuOpen} onClick={() => setAccountMenuOpen(open => !open)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/></svg></button>{accountMenuOpen && <div className="auth-settings-menu"><button type="button" onClick={() => { setProfileOpen(true); setAccountMenuOpen(false); }}>Profile</button><button type="button" disabled={busy} onClick={() => { setAccountMenuOpen(false); void run(signOut); }}>{busy ? "Please wait…" : "Sign out"}</button></div>}</div></section>;
}

function ProfileFields({ fields, update, age, includeUsername = false, includeBio }: { fields: Fields; update: <K extends keyof Fields>(key: K, value: Fields[K]) => void; age: number | null; includeUsername?: boolean; includeBio: boolean }) {
  const [genderOther, setGenderOther] = useState(false);
  const genders = ["Woman", "Man", "Non-binary", "Prefer to self-describe", "Prefer not to say"];
  return <div className="profile-fields">
    {includeUsername && <label>Username<input autoComplete="username" minLength={3} maxLength={24} pattern="[A-Za-z0-9_]{3,24}" value={fields.username} onChange={e => update("username", e.target.value)} required /><small>3–24 letters, numbers or underscores. Usernames are unique.</small></label>}
    <label>Date of birth<input type="date" max={new Date().toISOString().slice(0,10)} value={fields.date_of_birth} onChange={e => update("date_of_birth", e.target.value)} required />{age !== null && <small>Age: {age}</small>}</label>
    <label>Gender<select value={fields.gender} onChange={e => { update("gender", e.target.value); setGenderOther(e.target.value === "Other"); }} required><option value="">Choose gender</option>{genders.map(g => <option key={g}>{g}</option>)}<option>Other</option></select>{genderOther && <small>Choose “Other” only if none of the listed options fits.</small>}</label>
    <label>Country<input list="communication-lab-countries" autoComplete="country-name" value={fields.country} onChange={e => update("country", e.target.value)} placeholder="Choose or type a country" required /><datalist id="communication-lab-countries">{["India","United States","United Kingdom","Canada","Australia","New Zealand","Singapore","United Arab Emirates","Pakistan","Bangladesh","Sri Lanka","Nepal","Germany","France","Japan","Nigeria","South Africa","Brazil"].map(country => <option key={country} value={country} />)}</datalist></label>
    <label>State / province<input list="communication-lab-states" autoComplete="address-level1" value={fields.state} onChange={e => update("state", e.target.value)} placeholder="Choose or type a state" required /><datalist id="communication-lab-states">{["Andhra Pradesh","Arunachal Pradesh","Assam","Bihar","Chhattisgarh","Goa","Gujarat","Haryana","Himachal Pradesh","Jharkhand","Karnataka","Kerala","Madhya Pradesh","Maharashtra","Manipur","Meghalaya","Mizoram","Nagaland","Odisha","Punjab","Rajasthan","Sikkim","Tamil Nadu","Telangana","Tripura","Uttar Pradesh","Uttarakhand","West Bengal","Delhi","Jammu and Kashmir","California","Texas","New York","Ontario","Quebec","England","Scotland","Wales"].map(state => <option key={state} value={state} />)}</datalist></label>
    <label>City<input list="communication-lab-cities" autoComplete="address-level2" value={fields.city} onChange={e => update("city", e.target.value)} placeholder="Choose or type a city" required /><datalist id="communication-lab-cities">{["Bengaluru","Mumbai","Delhi","Hyderabad","Chennai","Kolkata","Pune","Ahmedabad","Jaipur","Kochi","New York","London","Toronto","Sydney","Singapore"].map(city => <option key={city} value={city} />)}</datalist></label>
    {includeBio && <label className="profile-bio">Bio <span>(optional)</span><textarea maxLength={500} rows={4} value={fields.bio} onChange={e => update("bio", e.target.value)} placeholder="A little about yourself…" /><small>{fields.bio.length}/500 characters</small></label>}
  </div>;
}
