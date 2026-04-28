import { escapeHtml } from "./helpers";

export function inlineMarkdown(input: string): string {
  const raw = String(input || "").replace(/\r\n/g, "\n");
  const lines = raw.split("\n");
  const output: string[] = [];
  let isCodeBlock = false;
  let codeLines: string[] = [];
  let listType = "";

  const applyInline = (text: string) =>
    escapeHtml(text)
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\*\*\*([^*]+)\*\*\*/g, "<strong><em>$1</em></strong>")
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/\*([^*]+)\*/g, "<em>$1</em>");

  const closeList = () => {
    if (listType === "ul") output.push("</ul>");
    if (listType === "ol") output.push("</ol>");
    listType = "";
  };

  for (const lineRaw of lines) {
    const line = lineRaw.trim();
    if (line.indexOf("```") === 0) {
      if (isCodeBlock) {
        output.push(`<pre><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
        codeLines = [];
        isCodeBlock = false;
      } else {
        closeList();
        isCodeBlock = true;
      }
      continue;
    }
    if (isCodeBlock) {
      codeLines.push(lineRaw);
      continue;
    }

    const headingMatch = line.match(/^(#{1,4})\s+(.+)$/);
    if (headingMatch) {
      closeList();
      output.push(
        `<h${headingMatch[1].length}>${applyInline(headingMatch[2])}</h${headingMatch[1].length}>`
      );
      continue;
    }

    const bulletMatch = line.match(/^[-*]\s+(.+)$/);
    if (bulletMatch) {
      if (listType !== "ul") {
        closeList();
        output.push("<ul>");
        listType = "ul";
      }
      output.push(`<li>${applyInline(bulletMatch[1])}</li>`);
      continue;
    }

    const numberMatch = line.match(/^\d+\.\s+(.+)$/);
    if (numberMatch) {
      if (listType !== "ol") {
        closeList();
        output.push("<ol>");
        listType = "ol";
      }
      output.push(`<li>${applyInline(numberMatch[1])}</li>`);
      continue;
    }

    if (!line) {
      closeList();
      continue;
    }

    closeList();
    output.push(`<p>${applyInline(line)}</p>`);
  }

  if (isCodeBlock) {
    output.push(`<pre><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
  }
  closeList();
  return output.join("");
}
