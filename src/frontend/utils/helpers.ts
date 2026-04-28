import type { DriveAuthState } from "../types";

export function parseJsonMaybe<T>(value: unknown): T | null {
  if (typeof value !== "string") {
    if (value === null || value === undefined) return null;
    return value as T;
  }
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

export function toSlashDate(value: string): string {
  return (value || "").trim().replace(/-/g, "/");
}

export function escapeHtml(value: string): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function toPlainText(value: unknown): string {
  return value == null ? "" : String(value);
}

export function parseAuthMessage(message: string): DriveAuthState {
  const text = String(message || "").trim();
  if (!text) return { checked: true, status: "error", message: "授權檢查未回傳訊息" };
  const authUrl = (text.match(/https?:\/\/\S+/g) || [])[0];
  const required = text.indexOf("需要先完成授權") >= 0;
  const ok = text.indexOf("Drive 權限可用") >= 0 && !required;
  if (ok) return { checked: true, status: "ok", message: text, authUrl };
  if (required) return { checked: true, status: "warn", message: text, authUrl };
  return { checked: true, status: "error", message: text, authUrl };
}

export function buildAuthErrorState(message: string): DriveAuthState {
  return { checked: true, status: "error", message };
}
