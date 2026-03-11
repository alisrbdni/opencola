import React from "react";
import { createRoot } from "react-dom/client";
import { PopupApp } from "./App";

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(<PopupApp />);
}
