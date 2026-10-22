import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/source-serif-4/latin-400.css";
import "@fontsource/source-serif-4/latin-600.css";
import { TooltipProvider } from "@/components/ui/tooltip";
import App from "./app/App";
import "./app/styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <TooltipProvider delayDuration={400}>
      <App />
    </TooltipProvider>
  </StrictMode>,
);
