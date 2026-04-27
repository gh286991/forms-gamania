import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const webappUrl = process.env.WEBAPP_URL || "https://script.google.com/macros/s/AKfycbx7Wv8uLqdJnkEID4o_Yd3qqnVnlugeDfSV9LiCm2JWV7AmX2NtF_eyERogYozF1QmI/exec";
const payloadPath = process.argv[2] || new URL("./a01-request.json", import.meta.url);
const accessToken = process.env.GOOGLE_ACCESS_TOKEN || await loadClaspAccessToken();

const payload = JSON.parse(await fs.readFile(payloadPath, "utf8"));
const headers = {
  "Content-Type": "application/json"
};

if (accessToken) {
  headers.Authorization = `Bearer ${accessToken}`;
}

let response;
try {
  response = await fetch(webappUrl, {
    method: "POST",
    headers,
    body: JSON.stringify(payload)
  });
} catch (error) {
  console.error(`Request failed before receiving a response: ${error.message}`);
  console.error("Check network access and WEBAPP_URL.");
  process.exit(1);
}

const body = await response.text();
const contentType = response.headers.get("content-type") || "";

if (!contentType.startsWith("application/json")) {
  console.error(`Request failed: expected JSON but received ${contentType || "unknown content type"} (HTTP ${response.status}).`);
  console.error("This usually means the Web App deployment is not accessible to this API caller.");
  console.error("Set Web App access to Anyone, or pass GOOGLE_ACCESS_TOKEN for a Google-authorized call.");
  process.exit(1);
}

console.log(body);

if (!response.ok) {
  process.exitCode = 1;
}

async function loadClaspAccessToken() {
  try {
    spawnSync("npx", ["clasp", "list-deployments", "--json"], {
      stdio: "ignore"
    });
    const claspPath = path.join(os.homedir(), ".clasprc.json");
    const raw = await fs.readFile(claspPath, "utf8");
    const config = JSON.parse(raw);
    return config?.tokens?.default?.access_token || "";
  } catch {
    return "";
  }
}
