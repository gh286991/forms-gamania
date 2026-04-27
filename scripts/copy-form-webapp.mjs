import fs from "node:fs";
import path from "node:path";
import { loadClaspToken, resolveWebappUrl } from "./webapp-utils.mjs";

function parseArgs(argv) {
  const options = {
    webappUrl: process.env.WEBAPP_URL || resolveWebappUrl(),
    form: "a01",
    configPath: null
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--webappUrl" && i + 1 < argv.length) {
      options.webappUrl = argv[++i];
    } else if ((arg === "--form" || arg === "-f") && i + 1 < argv.length) {
      options.form = argv[++i].toLowerCase();
    } else if ((arg === "--config" || arg === "-c") && i + 1 < argv.length) {
      options.configPath = argv[++i];
    }
  }

  if (!options.configPath) {
    options.configPath = path.resolve(process.cwd(), "examples", `${options.form}-content.sample.json`);
  }

  console.log(`表單代碼：${options.form}`);
  console.log(`使用 Web App URL：${options.webappUrl}`);

  return options;
}

function resolveMarkdownFiles(config, configDir) {
  if (!config.markdownFiles || typeof config.markdownFiles !== "object") {
    return config;
  }
  const result = { ...config };
  result.markdownReplace = result.markdownReplace || {};

  for (const [placeholder, files] of Object.entries(config.markdownFiles)) {
    const fileArray = Array.isArray(files) ? files : [files];
    const contents = [];
    for (const f of fileArray) {
      const resolved = path.resolve(configDir, f);
      if (!fs.existsSync(resolved)) {
        console.error(`markdownFiles: 找不到 ${resolved}`);
        continue;
      }
      console.log(`markdownFiles: 載入 ${resolved}`);
      contents.push(fs.readFileSync(resolved, "utf8"));
    }
    if (contents.length > 0) {
      result.markdownReplace[placeholder] = contents;
    }
  }

  delete result.markdownFiles;
  return result;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const token = loadClaspToken();
  const url = new URL(options.webappUrl);

  let response;
  if (options.configPath && fs.existsSync(options.configPath)) {
    console.log(`帶入設定：${options.configPath}`);
    const rawConfig = fs.readFileSync(options.configPath, "utf8");
    const configDir = path.dirname(path.resolve(options.configPath));
    const config = resolveMarkdownFiles(JSON.parse(rawConfig), configDir);

    response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        action: "copy_form",
        form: options.form,
        config
      })
    });
  } else {
    if (options.configPath) {
      console.log(`找不到設定檔 ${options.configPath}，改用無設定複製`);
    }
    url.searchParams.set("format", "json");
    url.searchParams.set("action", "copy_form");
    url.searchParams.set("form", options.form);

    response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` }
    });
  }

  const body = await response.text();
  if (response.status === 200 && /找不到以下指令碼函式：doPost/.test(body)) {
    console.error("偵測到 doPost 不存在：目前 Web App 仍使用舊版部署，請重新 deploy 成最新版本。");
    console.error(body);
    process.exitCode = 1;
    return;
  }
  console.log(body);

  try {
    const result = JSON.parse(body);
    if (result.newFileUrl) {
      console.log(`\n✅ 建立成功：${result.newFileUrl}`);
    }
  } catch { /* not JSON, ignore */ }

  if (!response.ok) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(String(error));
  process.exit(1);
});
