import { copyFile, mkdir, writeFile } from "node:fs/promises";
import { build } from "esbuild";

const footer = `
function runExample() {
  return AppScriptBundle.runExample.apply(this, arguments);
}

function doGet(e) {
  return AppScriptBundle.doGet.apply(this, arguments);
}

function doPost(e) {
  return AppScriptBundle.doPost.apply(this, arguments);
}

function createSampleSheet() {
  return AppScriptBundle.createSampleSheet.apply(this, arguments);
}

function authorizeDriveAccess() {
  return AppScriptBundle.authorizeDriveAccess.apply(this, arguments);
}

function listFolderItemsCli() {
  return AppScriptBundle.listFolderItemsCli.apply(this, arguments);
}

function copyA01TemplateDocToFolder() {
  return AppScriptBundle.copyA01TemplateDocToFolder.apply(this, arguments);
}

function copyTemplateDocToFolder() {
  return AppScriptBundle.copyTemplateDocToFolder.apply(this, arguments);
}

function inspectA01TemplateFields() {
  return AppScriptBundle.inspectA01TemplateFields.apply(this, arguments);
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
