import { copyFile, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { build } from "esbuild";
import postcss from "postcss";
import tailwindcss from "@tailwindcss/postcss";
import * as sass from "sass";

const footer = `
function doGet(e) {
  return AppScriptBundle.doGet.apply(this, arguments);
}

function doPost(e) {
  return AppScriptBundle.doPost.apply(this, arguments);
}

function authorizeDriveAccess() {
  return AppScriptBundle.authorizeDriveAccess.apply(this, arguments);
}

function listFolderItemsCli() {
  return AppScriptBundle.listFolderItemsCli.apply(this, arguments);
}

function copyFormTemplate() {
  return AppScriptBundle.copyFormTemplate.apply(this, arguments);
}

function inspectFormTemplate() {
  return AppScriptBundle.inspectFormTemplate.apply(this, arguments);
}

function copyTemplateDocToFolder() {
  return AppScriptBundle.copyTemplateDocToFolder.apply(this, arguments);
}

function inspectTemplateFields() {
  return AppScriptBundle.inspectTemplateFields.apply(this, arguments);
}

function getSharedUsers() {
  return AppScriptBundle.getSharedUsers.apply(this, arguments);
}
`;

await mkdir("dist/webapp", { recursive: true });

await build({
  entryPoints: ["src/app.ts"],
  bundle: true,
  outfile: "dist/Code.js",
  format: "iife",
  globalName: "AppScriptBundle",
  target: "es2020",
  footer: { js: footer },
  logLevel: "info"
});

await build({
  entryPoints: ["src/frontend/main.tsx"],
  bundle: true,
  outdir: "dist/webapp",
  entryNames: "react-app",
  format: "iife",
  target: "es2020",
  platform: "browser",
  jsx: "automatic",
  logLevel: "info",
  minify: true
});

await copyFile("appsscript.json", "dist/appsscript.json");
await writeFile("dist/.gitkeep", "");

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

// Write the JS bundle as a standalone GAS HTML file (loaded via include())
await writeFile(join("dist", "react-bundle.html"), `<script>\n${sanitizedBundle}\n</script>`);

async function renderHtmlTemplate(sourceFileName, outputFileName) {
  const template = await readFile(join("src", "html", sourceFileName), "utf8");
  const output = template
    .replace("<!-- REACT_APP_STYLES -->", `<style>\n${frontendCss}\n</style>`);
  await writeFile(join("dist", outputFileName), output);
}

await renderHtmlTemplate("react-form-selector.html", "form-selector.html");
await renderHtmlTemplate("react-form-a01.html", "form-a01.html");

// Copy other HTML files from src/html/ to dist/
const htmlFiles = await readdir("src/html");
for (const file of htmlFiles) {
  if (file.endsWith(".html")) {
    if (
      file === "react-form-selector.html" ||
      file === "react-form-a01.html" ||
      file === "form-selector.html" ||
      file === "form-a01.html"
    )
      continue;
    await copyFile(join("src/html", file), join("dist", file));
    console.log(`copied: src/html/${file} → dist/${file}`);
  }
}
