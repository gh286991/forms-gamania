import { loadClaspToken, resolveWebappUrl } from "./webapp-utils.mjs";

function parseArgs(argv) {
  const options = {
    webappUrl: process.env.WEBAPP_URL || resolveWebappUrl(),
    form: "a01",
    template: ""
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--webappUrl" && i + 1 < argv.length) {
      options.webappUrl = argv[++i];
    } else if ((arg === "--form" || arg === "-f") && i + 1 < argv.length) {
      options.form = argv[++i].toLowerCase();
    } else if ((arg === "--template" || arg === "-t") && i + 1 < argv.length) {
      options.template = argv[++i];
    }
  }

  console.log(`使用 Web App URL：${options.webappUrl}`);

  return options;
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
    url.searchParams.set("action", "inspect_form");
    url.searchParams.set("form", options.form);
  }

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` }
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
