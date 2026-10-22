import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/manrope";
import "@fontsource-variable/fraunces";
import "./styles.css";
import App from "./App";
import { AppErrorBoundary } from "./components/AppErrorBoundary";

const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
document.documentElement.classList.toggle("dark", prefersDark);
document.documentElement.style.colorScheme = prefersDark ? "dark" : "light";

const container = document.getElementById("root");
if (!container) {
  throw new Error("BatteryBloom root element is missing");
}

createRoot(container).render(
  <StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </StrictMode>,
);
