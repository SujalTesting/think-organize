import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import AuthBar from "./auth/AuthBar";
import { AuthProvider } from "./auth/AuthContext";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AuthProvider>
      <AuthBar />
      <App />
    </AuthProvider>
  </React.StrictMode>,
);
