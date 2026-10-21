/* @refresh reload */
import { render } from "solid-js/web";
import App from "./App";
import "./styles/app.css";

// ปิดเมนูคลิกขวาของ webview ทั้งแอป (คลิกขวา, Shift+F10, ปุ่มเมนูบนคีย์บอร์ด)
// ยกเว้น element ที่ทำเครื่องหมาย data-allow-context-menu ไว้ (เช่น แถวเพลงที่ใช้เมนูของตัวเอง)
document.addEventListener(
  "contextmenu",
  (event) => {
    const target = event.target as HTMLElement | null;
    if (target?.closest("[data-allow-context-menu]")) return;
    event.preventDefault();
  },
  { capture: true },
);

render(() => <App />, document.getElementById("root") as HTMLElement);
