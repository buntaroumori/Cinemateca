import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
/* Tipografías autoalojadas (woff2, unicode-range): cero peticiones a terceros. */
import "@fontsource-variable/inter/wght.css";
import "@fontsource-variable/cormorant-garamond/wght.css";
import "@fontsource-variable/cormorant-garamond/wght-italic.css";
import "@fontsource/ibm-plex-mono/latin-400.css";
import "@fontsource/ibm-plex-mono/latin-500.css";
import "@/styles/globals.css";
import { App } from "@/app/App";
import { startRouter } from "@/app/router";

startRouter();

const container = document.getElementById("root");
if (!container) {
  throw new Error("Cinemateca Sensorial: falta el contenedor raíz (#root) en index.html");
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
