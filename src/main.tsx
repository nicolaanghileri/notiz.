import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { Capture } from "./components/Capture";
import { initTheme } from "./lib/theme";
import "./styles.css";

/** Quick-Capture-Fenster: URL /capture (oder #/capture) */
const isCapture =
  /\/capture\/?$/.test(window.location.pathname) || window.location.hash === "#/capture";
if (isCapture) document.documentElement.dataset.route = "capture";

initTheme();

createRoot(document.getElementById("root")!).render(
  <StrictMode>{isCapture ? <Capture /> : <App />}</StrictMode>,
);
