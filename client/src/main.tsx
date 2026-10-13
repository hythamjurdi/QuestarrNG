import { createRoot } from "react-dom/client";
import "@fontsource-variable/inter";
import App from "./App";
import { applyInitialInterfaceLanguage } from "./lib/interface-locale";
import "./index.css";

applyInitialInterfaceLanguage();

createRoot(document.getElementById("root")!).render(<App />);
