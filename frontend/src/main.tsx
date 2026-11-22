import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
// Plus Jakarta Sans and Noto Sans Arabic come from index.html; JetBrains Mono for the few
// technical values (device keys, logs).
import "@fontsource-variable/jetbrains-mono";
import "./index.css";
import App from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
