import fs from "node:fs";
import { execSync } from "node:child_process";

const DEFAULT_WEBAPP_URL = "https://script.google.com/a/macros/gamania.com/s/AKfycbwXTVuKNQNdDYZvNLPG6MTLDuG09AxYmrUzlvMUbtrHK_wneF9ARn0anBIHWBSjNHUe/exec";

function resolveLatestWebappUrl() {
  try {
    const raw = execSync("npx clasp list-deployments --json", {
      encoding: "utf8"
    });
    const deployments = JSON.parse(raw);
    if (!Array.isArray(deployments)) {
      return null;
    }

    const candidates = deployments
      .filter((item) => item && typeof item === "object" && typeof item.deploymentId === "string" && Number.isFinite(Number(item.versionNumber)))
      .map((item) => ({
        id: item.deploymentId,
        versionNumber: Number(item.versionNumber || 0),
        description: String(item.description || "")
      }))
      .filter((item) => /TypeScript sample deployment/i.test(item.description));

    if (!candidates.length) {
      return null;
    }

    candidates.sort((left, right) => right.versionNumber - left.versionNumber);
    return `https://script.google.com/macros/s/${candidates[0].id}/exec`;
  } catch (error) {
    return null;
  }
}

function parseArgs(argv) {
  const fallbackWebAppUrl = resolveLatestWebappUrl();
  const options = {
    webappUrl: process.env.WEBAPP_URL || fallbackWebAppUrl || DEFAULT_WEBAPP_URL,
    template: ""
  };
  console.log(`使用 Web App URL: ${options.webappUrl}`);

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--webappUrl" && i + 1 < argv.length) {
      options.webappUrl = argv[i + 1];
      i += 1;
      continue;
    }

    if ((arg === "--template" || arg === "-t") && i + 1 < argv.length) {
      options.template = argv[i + 1];
      i += 1;
    }
  }

  return options;
}

function loadClaspToken() {
  const path = `${process.env.HOME}/.clasprc.json`;
  const content = fs.readFileSync(path, "utf8");
  const config = JSON.parse(content);
  const token = config?.tokens?.default?.access_token;

  if (!token) {
    throw new Error("找不到 clasp access token，請先執行 npx clasp login");
  }

  return token;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const token = loadClaspToken();
  const url = new URL(options.webappUrl);

  url.searchParams.set("format", "json");
  if (options.template) {
    url.searchParams.set("action", "inspect_template");
    url.searchParams.set("template", options.template);
  } else {
    url.searchParams.set("action", "inspect_a01");
  }

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  const body = await response.text();
  console.log(body);

  if (!response.ok) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(String(error));
  process.exit(1);
});
