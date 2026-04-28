import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { join, extname, resolve } from "node:path";
import { watch } from "node:fs";
import { build } from "esbuild";
import postcss from "postcss";
import tailwindcss from "@tailwindcss/postcss";
import * as sass from "sass";

const MIME = {
  ".html": "text/html;charset=utf-8",
  ".js":   "application/javascript",
  ".css":  "text/css",
  ".json": "application/json"
};

async function buildFrontend() {
  await mkdir("dist/webapp", { recursive: true });

  await build({
    entryPoints: ["src/frontend/main.tsx"],
    bundle: true,
    outdir: "dist/webapp",
    entryNames: "react-app",
    format: "iife",
    target: "es2020",
    platform: "browser",
    jsx: "automatic",
    logLevel: "silent"
  });

  const frontendJs = await readFile("dist/webapp/react-app.js", "utf8");
  const scssPath = resolve("src/frontend/styles.scss");
  const scssResult = sass.compile(scssPath);
  const rawCss = `@import "tailwindcss/theme" layer(theme);\n@import "tailwindcss/utilities" layer(utilities);\n@source "./**/*.{tsx,ts}";\n${scssResult.css}`;
  const cssResult = await postcss([tailwindcss()]).process(rawCss, {
    from: scssPath,
    to: resolve("dist/webapp/react-app.css")
  });
  const frontendCss = cssResult.css;
  const sanitizedBundle = frontendJs.replace(/<\/script>/gi, "<\\/script>");

  await writeFile(join("dist", "react-bundle.html"), `<script>\n${sanitizedBundle}\n</script>`);

  async function renderHtmlTemplate(sourceFileName, outputFileName) {
    const template = await readFile(join("src", "html", sourceFileName), "utf8");
    const output = template
      .replace("<!-- REACT_APP_STYLES -->", `<style>\n${frontendCss}\n</style>`)
      .replace(
        /\<\?\!\= HtmlService\.createHtmlOutputFromFile\('react-bundle'\)\.getContent\(\) \?\>/,
        `<script>\n${sanitizedBundle}\n</script>`
      );
    await writeFile(join("dist", outputFileName), output);
  }

  await renderHtmlTemplate("react-form-selector.html", "form-selector.html");
  await renderHtmlTemplate("react-form-a01.html", "form-a01.html");
  console.log(`[dev] rebuilt at ${new Date().toLocaleTimeString()}`);
}

// Initial build
await buildFrontend().catch(console.error);

// Watch src/frontend for changes
let rebuildTimer;
watch("src/frontend", { recursive: true }, () => {
  clearTimeout(rebuildTimer);
  rebuildTimer = setTimeout(() => buildFrontend().catch(console.error), 120);
});

// Simple static file server
const server = createServer(async (req, res) => {
  let urlPath = (req.url || "/").split("?")[0];
  if (urlPath === "/") urlPath = "/form-selector.html";
  const filePath = join("dist", urlPath);
  try {
    const content = await readFile(filePath);
    const ext = extname(filePath);
    res.writeHead(200, { "Content-Type": MIME[ext] || "text/plain" });
    res.end(content);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
});

server.listen(4000, () => {
  console.log("Dev server:  http://localhost:4000");
  console.log("Selector:    http://localhost:4000/form-selector.html");
  console.log("A01 Form:    http://localhost:4000/form-a01.html");
});
