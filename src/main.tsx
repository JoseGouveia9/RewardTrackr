import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import * as Sentry from "@sentry/react";
import "./index.css";
import { Provider } from "./app/provider";

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN as string | undefined,
  enabled: import.meta.env.PROD,
  environment: import.meta.env.MODE,
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.consoleLoggingIntegration({ levels: ["log", "warn", "error"] }),
  ],
  tracesSampleRate: 0.1,
  sendDefaultPii: false,
  enableLogs: true,
  _experiments: { enableLogs: true },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Provider />
  </StrictMode>,
);
