import fs from "node:fs";
import { execSync } from "node:child_process";

const DEPLOYMENT_DESCRIPTION = "TypeScript sample deployment";
const DEFAULT_WEBAPP_URL = "https://script.google.com/a/macros/gamania.com/s/AKfycbwXTVuKNQNdDYZvNLPG6MTLDuG09AxYmrUzlvMUbtrHK_wneF9ARn0anBIHWBSjNHUe/exec";

export function resolveWebappUrl() {
  try {
    const raw = execSync("npx clasp list-deployments --json", { encoding: "utf8" });
    const deployments = JSON.parse(raw);
    if (!Array.isArray(deployments)) return DEFAULT_WEBAPP_URL;

    const candidates = deployments
      .filter((d) => d && typeof d.deploymentId === "string" && Number.isFinite(Number(d.versionNumber)))
      .map((d) => ({
        id: d.deploymentId,
        version: Number(d.versionNumber || 0),
        description: String(d.description || "")
      }))
      .filter((d) => new RegExp(DEPLOYMENT_DESCRIPTION, "i").test(d.description))
      .sort((a, b) => b.version - a.version);

    return candidates.length > 0
      ? `https://script.google.com/macros/s/${candidates[0].id}/exec`
      : DEFAULT_WEBAPP_URL;
  } catch {
    return DEFAULT_WEBAPP_URL;
  }
}

export function loadClaspToken() {
  const path = `${process.env.HOME}/.clasprc.json`;
  const content = fs.readFileSync(path, "utf8");
  const config = JSON.parse(content);
  const token = config?.tokens?.default?.access_token;

  if (!token) {
    throw new Error("找不到 clasp access token，請先執行 npx clasp login");
  }

  return token;
}
