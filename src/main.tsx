import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { Provider } from "./app/provider";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Provider />
  </StrictMode>,
);
