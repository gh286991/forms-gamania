import { copyFile, mkdir, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { build } from "esbuild";

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
`;

await mkdir("dist", { recursive: true });

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

await copyFile("appsscript.json", "dist/appsscript.json");
await writeFile("dist/.gitkeep", "");

// Copy HTML files from src/html/ to dist/
const htmlFiles = await readdir("src/html");
for (const file of htmlFiles) {
  if (file.endsWith(".html")) {
    await copyFile(join("src/html", file), join("dist", file));
    console.log(`copied: src/html/${file} → dist/${file}`);
  }
}
