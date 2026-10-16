import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import SdetApp from "./SdetApp";
import AuthBar from "./auth/AuthBar";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import "./styles.css";

function Workspace() {
  const { user, profile, loading, profileLoading } = useAuth();
  const profileComplete = Boolean(profile?.full_name?.trim() && profile.username?.trim() && profile.date_of_birth && profile.gender?.trim() && profile.country?.trim() && profile.state?.trim() && profile.city?.trim());
  return (
    <>
      <AuthBar />
      {loading || (user && profileLoading && !profile) || (user && !profileComplete)
        ? null
        : user ? (profile?.learning_path === "sdet-ai" ? <SdetApp /> : <App />) : null}
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
