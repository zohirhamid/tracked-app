import React from "react";
import { createRoot } from "react-dom/client";
import { canonicalDevelopmentUrl } from "../lib.mjs";
import App from "./App.jsx";
import "../styles.css";

const canonicalUrl = canonicalDevelopmentUrl(window.location);
if (canonicalUrl) {
  window.location.replace(canonicalUrl);
} else {
  createRoot(document.getElementById("root")).render(
    <React.StrictMode><App /></React.StrictMode>,
  );
}
