import fs from "node:fs";

const DEFAULT_WEBAPP_URL = "https://script.google.com/a/macros/gamania.com/s/AKfycbwXTVuKNQNdDYZvNLPG6MTLDuG09AxYmrUzlvMUbtrHK_wneF9ARn0anBIHWBSjNHUe/exec";

function parseArgs(argv) {
  const options = {
    path: "",
    folderId: "",
    webappUrl: process.env.WEBAPP_URL || DEFAULT_WEBAPP_URL
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if ((arg === "--path" || arg === "-p") && i + 1 < argv.length) {
      options.path = argv[i + 1];
      i += 1;
      continue;
    }

    if ((arg === "--folderId" || arg === "-f") && i + 1 < argv.length) {
      options.folderId = argv[i + 1];
      i += 1;
      continue;
    }

    if (arg === "--webappUrl" && i + 1 < argv.length) {
      options.webappUrl = argv[i + 1];
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
  if (options.path) {
    url.searchParams.set("path", options.path);
  }
  if (options.folderId) {
    url.searchParams.set("folderId", options.folderId);
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
