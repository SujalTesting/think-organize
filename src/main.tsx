import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import AuthBar from "./auth/AuthBar";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import "./styles.css";

function Workspace() {
  const { user, profile, loading, profileLoading, recoveryMode } = useAuth();
  const profileComplete = Boolean(profile?.full_name?.trim() && profile.username?.trim() && profile.date_of_birth && profile.gender?.trim() && profile.country?.trim() && profile.state?.trim() && profile.city?.trim());
  return (
    <>
      <AuthBar />
      {loading || recoveryMode || (user && profileLoading && !profile) || (user && !profileComplete)
        ? null
        : user ? <App /> : null}
    </>
  );
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AuthProvider>
      <Workspace />
    </AuthProvider>
  </React.StrictMode>,
);
