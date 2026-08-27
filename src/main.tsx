import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./core/styles/global.css";

// 渲染前应用缓存的深色模式，避免首帧闪烁
try {
  if (localStorage.getItem("buffer:theme") === "dark") {
    document.documentElement.dataset.theme = "dark";
  }
} catch {
  /* ignore */
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
