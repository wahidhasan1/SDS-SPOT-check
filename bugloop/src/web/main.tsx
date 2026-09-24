import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/pages.css";
import { ApiClient } from "./api/client";
import { BugloopApp } from "./app/App";
import { initTheme } from "./lib/theme";

initTheme();

const client = new ApiClient({
  transport: (req) => fetch(req),
  base: "",
  mode: "server",
  tokenKey: "bugloop.session",
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BugloopApp client={client} router="browser" />
  </StrictMode>,
);
