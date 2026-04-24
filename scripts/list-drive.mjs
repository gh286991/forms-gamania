import { spawnSync } from "node:child_process";

const args = process.argv.slice(2);

let pathValue = "";
let folderIdValue = "";

for (let i = 0; i < args.length; i += 1) {
  const arg = args[i];
  if ((arg === "--path" || arg === "-p") && i + 1 < args.length) {
    pathValue = args[i + 1];
    i += 1;
    continue;
  }
  if ((arg === "--folderId" || arg === "-f") && i + 1 < args.length) {
    folderIdValue = args[i + 1];
    i += 1;
  }
}

const params = JSON.stringify([pathValue, folderIdValue]);
const result = spawnSync(
  "npx",
  ["clasp", "run", "listFolderItemsCli", "--params", params],
  { stdio: "inherit" }
);

process.exit(result.status ?? 1);
