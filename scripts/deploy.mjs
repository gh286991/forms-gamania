import { execSync } from "node:child_process";

const DESCRIPTION = "TypeScript sample deployment";

function listDeployments() {
  try {
    const raw = execSync("npx clasp list-deployments --json", { encoding: "utf8" });
    const deployments = JSON.parse(raw);
    if (!Array.isArray(deployments)) return [];
    return deployments
      .filter((d) => d && typeof d.deploymentId === "string" && Number.isFinite(Number(d.versionNumber)))
      .map((d) => ({ id: d.deploymentId, version: Number(d.versionNumber), description: String(d.description || "") }))
      .filter((d) => new RegExp(DESCRIPTION, "i").test(d.description))
      .sort((a, b) => b.version - a.version);
  } catch {
    return [];
  }
}

const candidates = listDeployments();

if (candidates.length > 0) {
  const latest = candidates[0];
  console.log(`更新現有 deployment ${latest.id} (v${latest.version}) → 新版本`);
  execSync(`npx clasp deploy --deploymentId "${latest.id}" --description "${DESCRIPTION}"`, { stdio: "inherit" });
} else {
  console.log("建立新 deployment");
  execSync(`npx clasp deploy --description "${DESCRIPTION}"`, { stdio: "inherit" });
}
