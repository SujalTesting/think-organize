import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useAuth, type Profile } from "./AuthContext";
import "./auth.css";

type Mode = "signin" | "signup";
type Fields = { full_name: string; username: string; date_of_birth: string; gender: string; country: string; state: string; city: string; bio: string; learning_path: "sdet-ai" | "genai-agentic-ai" };
const emptyFields: Fields = { full_name: "", username: "", date_of_birth: "", gender: "", country: "", state: "", city: "", bio: "", learning_path: "genai-agentic-ai" };
function fromProfile(p: Profile | null, name = ""): Fields {
  return { full_name: p?.full_name || name, username: p?.username || "", date_of_birth: p?.date_of_birth || "", gender: p?.gender || "", country: p?.country || "", state: p?.state || "", city: p?.city || "", bio: p?.bio || "", learning_path: p?.learning_path || "genai-agentic-ai" };
}
function complete(p: Profile | null) { return Boolean(p?.full_name?.trim() && p.username?.trim() && p.date_of_birth && p.gender?.trim() && p.country?.trim() && p.state?.trim() && p.city?.trim()); }
function ageFromDob(dob: string) { if (!dob) return null; const today = new Date(), birth = new Date(dob + "T12:00:00"); let age = today.getFullYear() - birth.getFullYear(); if (today.getMonth() < birth.getMonth() || (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())) age--; return age >= 0 ? age : null; }

export default function AuthBar() {
  const { user, profile, loading, profileLoading, configured, signInWithGoogle, signUpWithEmail, signInWithEmail, updatePassword, saveProfile, signOut } = useAuth();
  const [mode, setMode] = useState<Mode>("signin");
  const [rememberMe, setRememberMe] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fields, setFields] = useState<Fields>(emptyFields);
  const [editing, setEditing] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [editBaseline, setEditBaseline] = useState<Fields | null>(null);
  const [confirmDiscardOpen, setConfirmDiscardOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const isProfileComplete = complete(profile);
  const canChangePassword = true;
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
  function beginProfileEditing() {
    const saved = fromProfile(profile, typeof user?.user_metadata?.full_name === "string" ? user.user_metadata.full_name : typeof user?.user_metadata?.name === "string" ? user.user_metadata.name : "");
    setFields(saved);
    setEditBaseline(saved);
    setEditing(true);
    setProfileOpen(true);
    setConfirmDiscardOpen(false);
    setMessage("");
    setErrorMessage("");
  }

  function requestCloseProfileEditing() {
    const baseline = editBaseline || fromProfile(profile);
    const changed = (Object.keys(baseline) as (keyof Fields)[]).some(key => (fields[key] || "") !== (baseline[key] || ""));
    if (changed) {
      setConfirmDiscardOpen(true);
      return;
    }
    setFields(baseline);
    setEditing(false);
    setProfileOpen(true);
    setMessage("");
    setErrorMessage("");
  }

  function discardProfileChanges() {
    setFields(editBaseline || fromProfile(profile));
    setEditing(false);
    setProfileOpen(true);
    setConfirmDiscardOpen(false);
    setMessage("");
    setErrorMessage("");
  }

  function submitPasswordChange(event: FormEvent) {
    event.preventDefault();
    if (newPassword.length < 8) { setErrorMessage("Use at least 8 characters for your new password."); return; }
    if (newPassword !== confirmPassword) { setErrorMessage("The new passwords do not match."); return; }
    void run(async () => {
      await updatePassword(newPassword);
      setNewPassword("");
      setConfirmPassword("");
      setChangePasswordOpen(false);
      setMessage("Password updated successfully.");
    });
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (mode === "signup" || (user && !isProfileComplete) || (user && editing)) {
      if (!fields.full_name.trim() || !/^[A-Za-z0-9_]{3,24}$/.test(fields.username) || !fields.date_of_birth || !fields.gender || !fields.country.trim() || !fields.state.trim() || !fields.city.trim() || !["sdet-ai", "genai-agentic-ai"].includes(fields.learning_path)) {
        setErrorMessage("Complete every required field. Username must be 3–24 letters, numbers or underscores."); return;
      }
      const ageNow = ageFromDob(fields.date_of_birth);
      if (ageNow === null) { setErrorMessage("Enter a valid date of birth that is not in the future."); return; }
      const p = { ...fields, username: fields.username.trim() };
      void run(async () => {
        if (mode === "signup" && !user) return await signUpWithEmail(email, password, p);
        await saveProfile(p);
        setEditing(false);
        setProfileOpen(true);
        setEditBaseline(p);
        setConfirmDiscardOpen(false);
        setMessage("Profile saved.");
      });
      return;
    }
    if (!password) { setErrorMessage("Enter your password."); return; }
    if (!email.trim()) { setErrorMessage("Enter your email address."); return; }
    void run(() => signInWithEmail(email, password, rememberMe));
  }

  if (loading || (user && profileLoading && !profile)) return <div className="account-loading">GenAI Learning Lab · {loading ? "Checking your session…" : "Loading your profile…"}</div>;

  if (!configured) return <section className="account-screen"><div className="account-panel"><p className="account-kicker">GENAI LEARNING LAB</p><h1>Account setup required</h1><p>Supabase environment variables must be configured before you can sign in or create an account.</p></div></section>;

  if (!user) return (
    <section className="account-screen"><div className="account-panel">
      <p className="account-kicker">GENAI LEARNING LAB</p>
      <h1>{mode === "signup" ? "Create your account." : "Welcome back."}</h1>
      <p className="account-subtitle">{mode === "signup" ? "Create an account to save your learning progress across devices." : "Sign in to continue your learning journey."}</p>

      <form onSubmit={submit} className="account-form">
        {mode === "signup" && <><label>Full name<input autoComplete="name" value={fields.full_name} onChange={e => update("full_name", e.target.value)} required /></label><label>Username<input autoComplete="username" minLength={3} maxLength={24} pattern="[A-Za-z0-9_]{3,24}" value={fields.username} onChange={e => update("username", e.target.value)} required /><small>3–24 letters, numbers or underscores. Usernames are unique.</small></label></>}
        <label>Email address<input type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required /></label>
        <label>Password<input type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} minLength={mode === "signup" ? 8 : undefined} value={password} onChange={e => setPassword(e.target.value)} required />{mode === "signup" && <small>Use at least 8 characters.</small>}</label>
        {mode === "signup" && <><LearningPathPicker value={fields.learning_path} onChange={value => update("learning_path", value)} /><ProfileFields fields={fields} update={update} age={age} includeBio={false} /></>}
        {mode === "signin" && <label className="remember-me-option"><input type="checkbox" checked={rememberMe} onChange={e => setRememberMe(e.target.checked)} /> Remember me for 7 days</label>}
        {errorMessage && <p className="account-error" role="alert">{errorMessage}</p>}{message && <p className="account-message" role="status">{message}</p>}
        <button className="account-primary" disabled={busy} type="submit">{busy ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in"}</button>
      </form>
      {mode === "signin" && <><div className="account-divider"><span>or</span></div><button className="account-google" disabled={busy} onClick={() => void run(() => signInWithGoogle(rememberMe))}>Continue with Google</button><p className="account-switch">New to GenAI Learning Lab? <button onClick={() => { setFields(emptyFields); showMode("signup"); }}>Create an account</button></p></>}
      {mode !== "signin" && <p className="account-switch"><button onClick={() => showMode("signin")}>Back to sign in</button></p>}
    </div></section>
  );

  if (user && profileOpen && !editing) {
    const rows: [string, string][] = [
      ["Full name", profile?.full_name || "Not set"],
      ["Username", profile?.username || "Not set"],
      ["Email address", user.email || "Not available"],
      ["Date of birth", profile?.date_of_birth || "Not set"],
      ["Gender", profile?.gender || "Not set"],
      ["Country", profile?.country || "Not set"],
      ["State / province", profile?.state || "Not set"],
      ["City", profile?.city || "Not set"],
    ];
    const initials = (profile?.full_name || user.email || "Learner").trim().slice(0, 1).toUpperCase();
    return (
      <main className="profile-page-shell">
        <header className="profile-page-header">
          <div>
            <p className="account-kicker">ACCOUNT MANAGEMENT</p>
            <h1>Profile & settings</h1>
            <p className="account-subtitle">Manage your personal information and account security in one place.</p>
          </div>
          <button className="profile-back-button" type="button" onClick={() => setProfileOpen(false)}>
            <span aria-hidden="true">←</span> Back to learning workspace
          </button>
        </header>

        <div className="profile-page-layout">
          <aside className="profile-side-card">
            <div className="profile-avatar" aria-hidden="true">{initials}</div>
            <h2>{profile?.full_name || "Your profile"}</h2>
            <p className="profile-side-username">@{profile?.username || "username-not-set"}</p>
            <p className="profile-side-email">{user.email || "Email unavailable"}</p>
            <div className="profile-side-divider" />
            <div className="profile-side-status"><span className="profile-status-dot" /> Account active</div>
            <button className="account-primary" type="button" onClick={beginProfileEditing}>
              Edit personal information
            </button>
          </aside>

          <div className="profile-page-content">
            <section className="profile-section-card">
              <div className="profile-section-heading">
                <div><p className="profile-section-eyebrow">PERSONAL INFORMATION</p><h2>Profile details</h2><p>These details help personalize your learning workspace.</p></div>
 
              </div>
              <div className="profile-view-grid">{rows.map(([label, value]) => <div className="profile-view-field" key={label}><span>{label}</span><strong>{value}</strong></div>)}{profile?.bio?.trim() && <div className="profile-view-field profile-view-bio"><span>About me</span><strong>{profile.bio}</strong></div>}</div>
            </section>

            <section className="profile-section-card">
              <div className="profile-section-heading">
                <div><p className="profile-section-eyebrow">ACCOUNT SECURITY</p><h2>Password & sign-in</h2><p>Keep your account secure and manage your sign-in credentials.</p></div>
                <span className="profile-security-icon" aria-hidden="true">⌑</span>
              </div>
              {canChangePassword ? (
                !changePasswordOpen ? <div className="profile-security-row"><div><strong>Learning-IT Lab password</strong><p>Set or update a password for signing in to Learning-IT Lab. This is separate from your Google account password.</p></div><button className="profile-inline-action" type="button" onClick={() => { setChangePasswordOpen(true); setMessage(""); setErrorMessage(""); }}>Change password</button></div> :
                <form className="account-form profile-password-form" onSubmit={submitPasswordChange}>
                  <label>New password<input type="password" autoComplete="new-password" minLength={8} value={newPassword} onChange={e => setNewPassword(e.target.value)} required /><small>Use at least 8 characters.</small></label>
                  <label>Confirm new password<input type="password" autoComplete="new-password" minLength={8} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required /></label>
                  {errorMessage && <p className="account-error" role="alert">{errorMessage}</p>}
                  {message && <p className="account-message" role="status">{message}</p>}
                  <div className="profile-form-actions"><button className="account-primary" type="submit" disabled={busy}>{busy ? "Updating…" : "Update password"}</button><button className="profile-cancel-action" type="button" onClick={() => { setChangePasswordOpen(false); setNewPassword(""); setConfirmPassword(""); setErrorMessage(""); setMessage(""); }}>Cancel</button></div>
                </form>
              ) : <div className="profile-security-row"><div><strong>Google sign-in</strong><p>This account signs in through Google. Password management is handled by your Google account.</p></div><span className="profile-provider-pill">Google</span></div>}
            </section>

            <section className="profile-section-card profile-session-card">
              <div><p className="profile-section-eyebrow">SESSION</p><h2>Current account</h2><p>You are signed in as <strong>{user.email || profile?.username || "learner"}</strong>.</p></div>
              <button className="profile-signout-button" type="button" disabled={busy} onClick={() => void run(signOut)}>{busy ? "Please wait…" : "Sign out"}</button>
            </section>
          </div>
        </div>
      </main>
    );
  }

  if (!isProfileComplete || editing) {
    const nameFromGoogle = typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name : typeof user.user_metadata?.name === "string" ? user.user_metadata.name : "";
    return <section className="account-screen account-page-shell"><div className="account-panel account-panel-wide">
      {isProfileComplete && <div className="profile-edit-page-top"><div><p className="account-kicker">ACCOUNT MANAGEMENT</p><h1>Edit personal information</h1><p className="account-subtitle">Update your details. Your saved profile will remain unchanged until you save.</p></div><button type="button" className="profile-edit-close" aria-label="Close editing" onClick={requestCloseProfileEditing}>Close <span aria-hidden="true">×</span></button></div>}
      {!isProfileComplete && <><p className="account-kicker">COMPLETE YOUR PROFILE</p><h1>A few details first.</h1></>}
      
      <p className="account-subtitle">{isProfileComplete ? "Keep your profile information up to date." : "Please complete every required field before entering your learning workspace."}</p>
      <form onSubmit={submit} className="account-form">
        <label>Email address<input value={user.email || ""} readOnly /></label>
        <label>Full name<input autoComplete="name" value={fields.full_name || nameFromGoogle} onChange={e => update("full_name", e.target.value)} required /></label>
        <LearningPathPicker value={fields.learning_path} onChange={value => update("learning_path", value)} />
        <ProfileFields fields={fields === emptyFields ? fromProfile(profile, nameFromGoogle) : fields} update={update} age={ageFromDob((fields === emptyFields ? fromProfile(profile, nameFromGoogle) : fields).date_of_birth)} includeUsername={!isProfileComplete} includeBio={isProfileComplete} />
        {errorMessage && <p className="account-error" role="alert">{errorMessage}</p>}{message && <p className="account-message" role="status">{message}</p>}
        <button className="account-primary" type="submit" disabled={busy}>{busy ? "Saving…" : isProfileComplete ? "Save profile" : "Save and continue"}</button>
      </form>
      {isProfileComplete && <button type="button" className="account-link" onClick={requestCloseProfileEditing}>Cancel editing</button>}
      {!isProfileComplete && <button className="account-link" onClick={() => void run(signOut)}>Sign out</button>}
      {confirmDiscardOpen && <div className="profile-discard-backdrop" role="presentation"><section className="profile-discard-dialog" role="alertdialog" aria-modal="true" aria-labelledby="discard-title" aria-describedby="discard-description"><div className="profile-discard-icon" aria-hidden="true">!</div><h2 id="discard-title">Discard unsaved changes?</h2><p id="discard-description">You have changes that haven't been saved. Would you like to keep editing or discard them? Your previously saved profile will not be changed.</p><div className="profile-discard-actions"><button type="button" className="profile-keep-editing" onClick={() => setConfirmDiscardOpen(false)}>Keep editing</button><button type="button" className="profile-discard-changes" onClick={discardProfileChanges}>Discard changes</button></div></section></div>}
    </div></section>;
  }

  return <section className="auth-bar" aria-label="Account"><div className="workspace-brand-lockup"><div className="workspace-brand-mark" aria-hidden="true"><svg viewBox="0 0 32 32"><path d="M16 4.5 25.5 10v12L16 27.5 6.5 22V10z" fill="none" stroke="currentColor" strokeWidth="1.6"/><circle cx="16" cy="16" r="3.2" fill="currentColor"/><circle cx="16" cy="7.5" r="1.5" fill="#b8d4a9"/><circle cx="23.3" cy="20.2" r="1.5" fill="#b8d4a9"/><circle cx="8.7" cy="20.2" r="1.5" fill="#b8d4a9"/></svg></div><div><strong>GenAI Learning Lab</strong><small>Learn · Build · Evaluate</small></div></div><div className="auth-menu-wrap"><button type="button" className="auth-settings-button" aria-label="Account settings" aria-expanded={accountMenuOpen} onClick={() => setAccountMenuOpen(open => !open)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/></svg></button>{accountMenuOpen && <div className="auth-settings-menu"><button type="button" onClick={() => { setProfileOpen(true); setAccountMenuOpen(false); }}>Profile</button><button type="button" disabled={busy} onClick={() => { setAccountMenuOpen(false); void run(signOut); }}>{busy ? "Please wait…" : "Sign out"}</button></div>}</div></section>;
}

function LearningPathPicker({ value, onChange }: { value: "sdet-ai" | "genai-agentic-ai"; onChange: (value: "sdet-ai" | "genai-agentic-ai") => void }) { return <fieldset className="learning-path-picker"><legend>Which learning path would you like to start with?</legend><label className={`learning-path-option ${value === "sdet-ai" ? "selected" : ""}`}><input type="radio" name="learning_path" value="sdet-ai" checked={value === "sdet-ai"} onChange={() => onChange("sdet-ai")} /><span><strong>A. SDET + AI</strong><small>Software foundations, QA, Playwright, APIs, CI/CD and AI-assisted testing.</small></span></label><label className={`learning-path-option ${value === "genai-agentic-ai" ? "selected" : ""}`}><input type="radio" name="learning_path" value="genai-agentic-ai" checked={value === "genai-agentic-ai"} onChange={() => onChange("genai-agentic-ai")} /><span><strong>B. GenAI + AI Agents</strong><small>Continue with the existing GenAI, agent engineering, RAG and evaluation curriculum.</small></span></label></fieldset>; }

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
