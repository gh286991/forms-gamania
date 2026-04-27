export function renderMarkdownToBody(
  body: GoogleAppsScript.Document.Body,
  markdown: string,
  startIndex: number,
  renderMode: "raw" | "rich"
): void {
  const cards = splitMarkdownIntoCards(markdown);

  if (renderMode === "raw") {
    if (cards.length > 1) {
      renderRawMarkdownCards(body, cards, startIndex);
    } else {
      renderRawMarkdownLines(body, markdown, startIndex);
    }
    return;
  }

  if (cards.length > 1) {
    renderMarkdownCards(body, cards, startIndex);
  } else {
    renderMarkdownLines(body, markdown, startIndex);
  }
}

function splitMarkdownIntoCards(markdown: string): string[] {
  const lines = markdown.split("\n");
  const cards: string[] = [];
  let current: string[] = [];
  let inCodeBlock = false;

  for (const line of lines) {
    if (line.startsWith("```")) inCodeBlock = !inCodeBlock;
    if (!inCodeBlock && line.trim() === "---") {
      cards.push(current.join("\n"));
      current = [];
      continue;
    }
    current.push(line);
  }
  if (current.length > 0) cards.push(current.join("\n"));
  return cards.filter((c) => c.trim());
}

function extractFirstHeadingTitle(markdown: string): string {
  for (const line of markdown.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    return (trimmed.startsWith("# ") && !trimmed.startsWith("## "))
      ? trimmed.slice(2).trim()
      : "";
  }
  return "";
}

function extractCardTitle(markdown: string): { title: string; content: string } {
  const lines = markdown.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed) continue;
    if (trimmed.startsWith("# ") && !trimmed.startsWith("## ")) {
      return { title: trimmed.slice(2).trim(), content: lines.slice(i + 1).join("\n") };
    }
    break;
  }
  return { title: "", content: markdown };
}

function renderRawMarkdownLines(
  body: GoogleAppsScript.Document.Body,
  markdown: string,
  startIndex: number
): void {
  let idx = startIndex;
  for (const line of markdown.split("\n")) {
    const text = line.length > 0 ? line : " ";
    const para = body.insertParagraph(idx, text);
    para.editAsText().setFontSize(11);
    para.editAsText().setFontFamily("Arial");
    idx += 1;
  }
}

function renderRawMarkdownCards(
  body: GoogleAppsScript.Document.Body,
  cards: string[],
  startIndex: number
): void {
  let idx = startIndex;
  for (let i = 0; i < cards.length; i += 1) {
    const cardMarkdown = cards[i].trim();
    const title = extractFirstHeadingTitle(cardMarkdown);

    if (title) {
      const table = body.insertTable(idx, [[title], [" "]]);
      table.setBorderColor("#000000");
      table.setBorderWidth(1);
      styleCardTitleCell(table.getRow(0).getCell(0), title);
      renderRawMarkdownToCell(table.getRow(1).getCell(0), cardMarkdown);
    } else {
      const table = body.insertTable(idx, [[" "]]);
      table.setBorderColor("#000000");
      table.setBorderWidth(1);
      renderRawMarkdownToCell(table.getRow(0).getCell(0), cardMarkdown);
    }

    idx += 1;
    if (i < cards.length - 1) {
      body.insertParagraph(idx, " ").editAsText().setFontSize(4);
      idx += 1;
    }
  }
}

function renderRawMarkdownToCell(cell: GoogleAppsScript.Document.TableCell, markdown: string): void {
  padCell(cell);
  let wrote = false;

  for (const line of markdown.split("\n")) {
    const text = line.length > 0 ? line : " ";
    const para = cell.appendParagraph(text);
    para.editAsText().setFontSize(11);
    para.editAsText().setFontFamily("Arial");
    wrote = true;
  }

  if (wrote) removeFirstEmptyParagraph(cell);
}

function renderMarkdownLines(
  body: GoogleAppsScript.Document.Body,
  markdown: string,
  startIndex: number
): void {
  let idx = startIndex;
  let inCodeBlock = false;
  let codeLines: string[] = [];

  for (const line of markdown.split("\n")) {
    if (line.startsWith("```")) {
      if (inCodeBlock) {
        for (const codeLine of codeLines) {
          body.insertParagraph(idx, codeLine || " ").editAsText().setFontFamily("Courier New");
          idx++;
        }
        codeLines = [];
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) { codeLines.push(line); continue; }
    if (!line.trim()) continue;

    if (line.startsWith("#### ")) {
      body.insertParagraph(idx, line.slice(5) || " ").setHeading(DocumentApp.ParagraphHeading.HEADING4);
    } else if (line.startsWith("### ")) {
      body.insertParagraph(idx, line.slice(4) || " ").setHeading(DocumentApp.ParagraphHeading.HEADING3);
    } else if (line.startsWith("## ")) {
      body.insertParagraph(idx, line.slice(3) || " ").setHeading(DocumentApp.ParagraphHeading.HEADING2);
    } else if (line.startsWith("# ")) {
      body.insertParagraph(idx, line.slice(2) || " ").setHeading(DocumentApp.ParagraphHeading.HEADING1);
    } else if (/^[-*] /.test(line)) {
      const content = line.slice(2);
      const item = body.insertListItem(idx, content || " ");
      item.setGlyphType(DocumentApp.GlyphType.BULLET);
      applyInlineMarkdown(item.editAsText(), content);
    } else if (/^\d+\. /.test(line)) {
      const content = line.replace(/^\d+\. /, "");
      const item = body.insertListItem(idx, content || " ");
      item.setGlyphType(DocumentApp.GlyphType.NUMBER);
      applyInlineMarkdown(item.editAsText(), content);
    } else {
      const para = body.insertParagraph(idx, line || " ");
      applyInlineMarkdown(para.editAsText(), line);
    }

    idx++;
  }
}

function renderMarkdownCards(
  body: GoogleAppsScript.Document.Body,
  cards: string[],
  startIndex: number
): void {
  let idx = startIndex;
  for (let i = 0; i < cards.length; i++) {
    const { title, content } = extractCardTitle(cards[i].trim());

    if (title) {
      const table = body.insertTable(idx, [[title], [" "]]);
      table.setBorderColor("#000000");
      table.setBorderWidth(1);
      styleCardTitleCell(table.getRow(0).getCell(0), title);
      renderMarkdownToCell(table.getRow(1).getCell(0), content);
    } else {
      const table = body.insertTable(idx, [[" "]]);
      table.setBorderColor("#000000");
      table.setBorderWidth(1);
      renderMarkdownToCell(table.getRow(0).getCell(0), cards[i].trim());
    }

    idx++;
    if (i < cards.length - 1) {
      body.insertParagraph(idx, " ").editAsText().setFontSize(4);
      idx++;
    }
  }
}

function renderMarkdownToCell(cell: GoogleAppsScript.Document.TableCell, markdown: string): void {
  padCell(cell);
  let inCodeBlock = false;
  let codeLines: string[] = [];
  let elementCount = 0;

  for (const line of markdown.split("\n")) {
    if (line.startsWith("```")) {
      if (inCodeBlock) {
        for (const codeLine of codeLines) {
          const para = cell.appendParagraph(codeLine || " ");
          para.editAsText().setFontFamily("Courier New");
          para.editAsText().setFontSize(10);
          para.editAsText().setBackgroundColor("#f5f5f5");
          elementCount++;
        }
        codeLines = [];
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) { codeLines.push(line); continue; }
    if (!line.trim()) continue;

    if (line.startsWith("#### ")) {
      const text = line.slice(5) || " ";
      applyCellHeading(cell.appendParagraph(text), text, 11);
    } else if (line.startsWith("### ")) {
      const text = line.slice(4) || " ";
      applyCellHeading(cell.appendParagraph(text), text, 13);
    } else if (line.startsWith("## ")) {
      const text = line.slice(3) || " ";
      applyCellHeading(cell.appendParagraph(text), text, 16);
    } else if (line.startsWith("# ")) {
      const text = line.slice(2) || " ";
      applyCellHeading(cell.appendParagraph(text), text, 20);
    } else if (/^[-*] /.test(line)) {
      const content = line.slice(2);
      const item = (cell as unknown as { appendListItem(t: string): GoogleAppsScript.Document.ListItem }).appendListItem(content || " ");
      item.setGlyphType(DocumentApp.GlyphType.BULLET);
      applyInlineMarkdown(item.editAsText(), content);
    } else if (/^\d+\. /.test(line)) {
      const content = line.replace(/^\d+\. /, "");
      const item = (cell as unknown as { appendListItem(t: string): GoogleAppsScript.Document.ListItem }).appendListItem(content || " ");
      item.setGlyphType(DocumentApp.GlyphType.NUMBER);
      applyInlineMarkdown(item.editAsText(), content);
    } else {
      const para = cell.appendParagraph(line || " ");
      applyInlineMarkdown(para.editAsText(), line);
    }
    elementCount++;
  }

  if (elementCount > 0) removeFirstEmptyParagraph(cell);
}

function styleCardTitleCell(cell: GoogleAppsScript.Document.TableCell, title: string): void {
  cell.setBackgroundColor("#000000");
  cell.setPaddingTop(6);
  cell.setPaddingBottom(6);
  cell.setPaddingLeft(10);
  cell.setPaddingRight(10);
  const titleText = cell.editAsText();
  titleText.setForegroundColor("#ffffff");
  titleText.setBold(true);
  titleText.setFontSize(13);
  cell.getChild(0).asParagraph().setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  // re-set title text after styling (cell was initialized with a placeholder)
  cell.editAsText().setText(title);
}

function padCell(cell: GoogleAppsScript.Document.TableCell): void {
  cell.setPaddingTop(8);
  cell.setPaddingBottom(8);
  cell.setPaddingLeft(10);
  cell.setPaddingRight(10);
}

function applyCellHeading(
  para: GoogleAppsScript.Document.Paragraph,
  text: string,
  fontSize: number
): void {
  applyInlineMarkdown(para.editAsText(), text);
  const et = para.editAsText();
  const len = et.getText().length;
  if (len > 0) {
    et.setBold(0, len - 1, true);
    et.setFontSize(0, len - 1, fontSize);
  }
}

function removeFirstEmptyParagraph(cell: GoogleAppsScript.Document.TableCell): void {
  try {
    const first = cell.getChild(0);
    const text = first.asParagraph().getText();
    if (text === " " || text === "") first.removeFromParent();
  } catch (_e) { /* keep default paragraph if removal fails */ }
}

function applyInlineMarkdown(textEl: GoogleAppsScript.Document.Text, line: string): void {
  if (!line) return;
  type Segment = { text: string; bold: boolean; italic: boolean; code: boolean };
  const segments: Segment[] = [];
  let remaining = line;

  while (remaining.length > 0) {
    const codeMatch = remaining.match(/^`([^`]+)`/);
    if (codeMatch) {
      segments.push({ text: codeMatch[1], bold: false, italic: false, code: true });
      remaining = remaining.slice(codeMatch[0].length);
      continue;
    }
    const boldItalicMatch = remaining.match(/^\*\*\*([^*]+)\*\*\*/);
    if (boldItalicMatch) {
      segments.push({ text: boldItalicMatch[1], bold: true, italic: true, code: false });
      remaining = remaining.slice(boldItalicMatch[0].length);
      continue;
    }
    const boldMatch = remaining.match(/^\*\*([^*]+)\*\*/);
    if (boldMatch) {
      segments.push({ text: boldMatch[1], bold: true, italic: false, code: false });
      remaining = remaining.slice(boldMatch[0].length);
      continue;
    }
    const italicMatch = remaining.match(/^\*([^*]+)\*/);
    if (italicMatch) {
      segments.push({ text: italicMatch[1], bold: false, italic: true, code: false });
      remaining = remaining.slice(italicMatch[0].length);
      continue;
    }
    const nextSpecial = remaining.search(/[*`]/);
    if (nextSpecial <= 0) {
      segments.push({ text: remaining, bold: false, italic: false, code: false });
      remaining = "";
    } else {
      segments.push({ text: remaining.slice(0, nextSpecial), bold: false, italic: false, code: false });
      remaining = remaining.slice(nextSpecial);
    }
  }

  const plainText = segments.map((s) => s.text).join("");
  if (!plainText) return;

  textEl.setText(plainText);
  textEl.setFontSize(11);
  textEl.setFontFamily("Arial");

  let pos = 0;
  for (const seg of segments) {
    const end = pos + seg.text.length - 1;
    if (seg.text.length > 0) {
      if (seg.bold) textEl.setBold(pos, end, true);
      if (seg.italic) textEl.setItalic(pos, end, true);
      if (seg.code) {
        textEl.setFontFamily(pos, end, "Courier New");
        textEl.setFontSize(pos, end, 10);
      }
    }
    pos += seg.text.length;
  }
}
