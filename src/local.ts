import { buildGreeting, buildSheetRows } from "./lib";

const greeting = buildGreeting({ name: "Local runner" });
console.log(greeting);

const rows = buildSheetRows(["Ada", "Linus", "Grace"]);
console.table(rows);
