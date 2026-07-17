import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../index.css";
import ErrorBoundary from "../components/ErrorBoundary.jsx";
import QuickAdd from "./QuickAdd.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ErrorBoundary fallbackMessage="Quick add hit an error. Open the full app to bookmark this page.">
      <QuickAdd />
    </ErrorBoundary>
  </StrictMode>
);
