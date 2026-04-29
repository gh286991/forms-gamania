import type { ApplyConfigReport, StructuredDocConfig } from "./types";
import { renderMarkdownToBody } from "./markdown";

export function hasStructuredDocConfig(config?: StructuredDocConfig): boolean {
  if (!config) return false;
  return Boolean(
    config.clearTemplate === true ||
    (config.replaceText && Object.keys(config.replaceText).length > 0) ||
    (config.keyValues && Object.keys(config.keyValues).length > 0) ||
    (config.tableRows && config.tableRows.length > 0) ||
    (config.sections && config.sections.length > 0) ||
    (config.appendParagraphs && config.appendParagraphs.length > 0) ||
    (config.bullets && config.bullets.length > 0) ||
    (config.removeMarkers && config.removeMarkers.length > 0) ||
    (config.markdownReplace && Object.keys(config.markdownReplace).length > 0) ||
    (config.markdownSections && config.markdownSections.length > 0)
  );
}

export function applyStructuredConfigToDoc(docId: string, config: StructuredDocConfig): ApplyConfigReport {
  const doc = DocumentApp.openById(docId);
  const allBodies = getAllDocBodies(doc);
  const body = allBodies[0];
  const report: ApplyConfigReport = {
    replacedTexts: [],
    replacedKeyValues: [],
    appendedKeyValues: [],
    replacedMarkdown: []
  };

  const sortedKeyEntries = config.keyValues
    ? Object.entries(config.keyValues).sort(([a], [b]) => b.length - a.length)
    : [];
  const appendUnknownKeyValues = config.appendUnknownKeyValues === true;

  if (config.clearTemplate) {
    clearMappedKeyValuesInPlace(body, sortedKeyEntries.map(([key]) => key));
  }

  if (config.tableRows) {
    for (const spec of config.tableRows) {
      for (const b of allBodies) {
        expandTableRows(b, spec);
      }
    }
  }

  if (config.replaceText) {
    for (const [key, value] of Object.entries(config.replaceText)) {
      if (!key) continue;
      const pattern = escapeRegexForReplace(key);
      for (const b of allBodies) {
        if (b.findText(pattern)) {
          b.replaceText(pattern, value || "");
          if (!report.replacedTexts.includes(key)) report.replacedTexts.push(key);
        }
      }
    }
  }

  if (config.removeMarkers) {
    for (const marker of config.removeMarkers) {
      if (!marker) continue;
      for (const b of allBodies) {
        b.replaceText(escapeRegexForReplace(marker), "");
      }
    }
  }

  if (sortedKeyEntries.length > 0) {
    const appendRows: string[][] = [];
    for (const [key, rawValue] of sortedKeyEntries) {
      const value = rawValue ?? "";
      if (applyKeyValueInPlace(body, key, value)) {
        report.replacedKeyValues.push(key);
        continue;
      }
      if (!appendUnknownKeyValues) {
        report.appendedKeyValues.push(`${key}（未對位）`);
        continue;
      }
      appendRows.push([key, value]);
      report.appendedKeyValues.push(key);
    }

    if (appendRows.length > 0) {
      body.appendParagraph("");
      body.appendParagraph("欄位資料").setHeading(DocumentApp.ParagraphHeading.HEADING2);
      const table = body.appendTable(appendRows);
      for (let r = 0; r < appendRows.length; r += 1) {
        table.getCell(r, 0).editAsText().setBold(true);
      }
    }
  }

  if (config.sections) {
    for (const section of config.sections) {
      const title = (section.title || "").trim();
      if (!title) continue;
      body.appendParagraph("");
      body.appendParagraph(title).setHeading(DocumentApp.ParagraphHeading.HEADING2);
      const lines = Array.isArray(section.content) ? section.content : [section.content];
      for (const line of lines) {
        if (line !== undefined && line !== null) body.appendParagraph(String(line));
      }
    }
  }

  if (config.appendParagraphs) {
    for (const line of config.appendParagraphs) {
      if (line) body.appendParagraph(line);
    }
  }

  if (config.bullets) {
    for (const item of config.bullets) {
      if (item) body.appendListItem(item);
    }
  }

  if (config.markdownReplace) {
    const renderMode: "raw" | "rich" = config.markdownRenderMode === "rich" ? "rich" : "raw";
    for (const [placeholder, rawValue] of Object.entries(config.markdownReplace)) {
      if (!placeholder || !rawValue) continue;
      const combined = Array.isArray(rawValue)
        ? rawValue.filter((v) => v).join("\n---\n")
        : rawValue;
      if (!combined) continue;
      for (const b of allBodies) {
        if (insertMarkdownAtPlaceholder(b, placeholder, combined, renderMode)) {
          report.replacedMarkdown.push(placeholder);
          break;
        }
      }
    }
  }

  if (config.markdownSections) {
    const renderMode: "raw" | "rich" = config.markdownRenderMode === "rich" ? "rich" : "raw";
    const specBody = allBodies.length > 1 ? allBodies[1] : body;
    for (const section of config.markdownSections) {
      const title = String(section.title || "").trim();
      const markdown = Array.isArray(section.content)
        ? section.content.filter((line) => line !== undefined && line !== null).join("\n")
        : String(section.content || "");
      if (!markdown.trim()) continue;

      specBody.appendParagraph("");
      if (title) specBody.appendParagraph(title).setHeading(DocumentApp.ParagraphHeading.HEADING2);
      renderMarkdownToBody(specBody, markdown, specBody.getNumChildren(), renderMode);
      report.replacedMarkdown.push(title ? `append:${title}` : "append:markdown");
    }
  }

  doc.saveAndClose();
  return report;
}

export function collectBodyLines(body: GoogleAppsScript.Document.Body): string[] {
  const lines: string[] = [];
  for (let i = 0; i < body.getNumChildren(); i += 1) {
    lines.push(...collectElementLines(body.getChild(i)));
  }
  return lines;
}

export function extractPlaceholdersFromLine(line: string): string[] {
  const curly = line.match(/\{\{[^{}]+\}\}/g) || [];
  const bracket = line.match(/【[^【】]+】/g) || [];
  return [...curly, ...bracket].map((t) => t.trim());
}

export function extractLabelCandidate(line: string): string {
  const normalized = line.replace(/\s+/g, " ").trim();
  if (!normalized) return "";

  const colonIndex = normalized.search(/[：:]/);
  if (colonIndex > 0 && colonIndex <= 30) {
    const key = normalizeFieldKey(normalized.slice(0, colonIndex));
    if (key) return key;
  }

  const blankMatch = normalized.match(/^(.{1,30}?)[-_＿.。]{3,}\s*$/);
  if (blankMatch?.[1]) {
    const key = normalizeFieldKey(blankMatch[1]);
    if (key) return key;
  }

  return "";
}

export function collectTableKeyCandidates(body: GoogleAppsScript.Document.Body): string[] {
  const keys = new Set<string>();
  for (let i = 0; i < body.getNumChildren(); i += 1) {
    const child = body.getChild(i);
    if (child.getType() !== DocumentApp.ElementType.TABLE) continue;
    const table = child.asTable();
    for (let row = 0; row < table.getNumRows(); row += 1) {
      const tableRow = table.getRow(row);
      for (let col = 0; col < tableRow.getNumCells(); col += 1) {
        const cellText = tableRow.getCell(col).getText();
        const key = normalizeFieldKey(cellText);
        if (!key) continue;
        if (/[：:]/.test(cellText)) {
          keys.add(key);
          continue;
        }
        if (col + 1 < tableRow.getNumCells()) {
          const valueCell = tableRow.getCell(col + 1).getText().trim();
          if (!valueCell || /^[-_＿.。 \t　]{2,}$/.test(valueCell)) keys.add(key);
        }
      }
    }
  }
  return [...keys];
}

function insertMarkdownAtPlaceholder(
  body: GoogleAppsScript.Document.Body,
  placeholder: string,
  markdown: string,
  renderMode: "raw" | "rich"
): boolean {
  const found = body.findText(escapeRegexForReplace(placeholder));
  if (!found) return false;
  const parentElement = found.getElement().getParent();
  const insertIndex = body.getChildIndex(parentElement);
  renderMarkdownToBody(body, markdown, insertIndex, renderMode);
  try {
    parentElement.removeFromParent();
  } catch (_e) {
    try { parentElement.asParagraph().setText(" "); } catch (_e2) { /* leave a space */ }
  }
  return true;
}

function clearMappedKeyValuesInPlace(body: GoogleAppsScript.Document.Body, keys: string[]): void {
  const sorted = [...keys].sort((a, b) => b.length - a.length);
  for (const key of sorted) {
    if (key.trim()) applyKeyValueInPlace(body, key, "");
  }
}

function applyKeyValueInPlace(body: GoogleAppsScript.Document.Body, key: string, value: string): boolean {
  const trimmedKey = key.trim();
  if (!trimmedKey) return false;

  const markerCandidates = [
    `{{${trimmedKey}}}`,
    `【${trimmedKey}】`,
    `[${trimmedKey}]`,
    `＜${trimmedKey}＞`,
    `<${trimmedKey}>`
  ];
  for (const marker of markerCandidates) {
    if (replaceIfExists(body, escapeRegexForReplace(marker), value)) return true;
  }

  if (fillKeyValueInTables(body, trimmedKey, value)) return true;

  if (replaceIfExists(body, `^${escapeRegexForReplace(trimmedKey)}\\s*[：:]\\s*[^\\r\\n]*`, `${trimmedKey}：${value}`)) return true;
  if (replaceIfExists(body, `^${escapeRegexForReplace(trimmedKey)}\\s*[-_＿.。\\s　]*$`, `${trimmedKey} ${value}`)) return true;

  return false;
}

function replaceIfExists(body: GoogleAppsScript.Document.Body, pattern: string, replacement: string): boolean {
  const found = body.findText(pattern);
  if (!found) return false;
  if (found.getStartOffset() !== 0) return false;
  body.replaceText(pattern, replacement);
  return true;
}

function fillKeyValueInTables(body: GoogleAppsScript.Document.Body, key: string, value: string): boolean {
  const targetKey = normalizeFieldKey(key);
  if (!targetKey) return false;

  for (let i = 0; i < body.getNumChildren(); i += 1) {
    const child = body.getChild(i);
    if (child.getType() !== DocumentApp.ElementType.TABLE) continue;
    const table = child.asTable();
    for (let row = 0; row < table.getNumRows(); row += 1) {
      const tableRow = table.getRow(row);
      for (let col = 0; col < tableRow.getNumCells(); col += 1) {
        const cell = tableRow.getCell(col);
        const cellText = cell.getText();
        if (normalizeFieldKey(cellText) !== targetKey) continue;

        const colonIndex = cellText.search(/[：:]/);
        if (colonIndex >= 0) {
          cell.editAsText().setText(cellText.substring(0, colonIndex + 1) + value);
          return true;
        }

        if (tableRow.getNumCells() === 2 && col + 1 < tableRow.getNumCells()) {
          const valueCell = tableRow.getCell(col + 1);
          const valueCellText = valueCell.getText();
          if (hasCheckboxPattern(valueCellText)) {
            applyCheckboxValue(valueCell, valueCellText, value);
          } else {
            valueCell.editAsText().setText(value);
          }
          return true;
        }
      }
    }
  }

  return false;
}

function hasCheckboxPattern(text: string): boolean {
  return /[☐■□☑]/.test(text);
}

function applyCheckboxValue(cell: GoogleAppsScript.Document.TableCell, cellText: string, value: string): void {
  const selected = value.split(/[,、，]\s*/).map((s) => s.trim()).filter((s) => s.length > 0);
  if (selected.length === 0) return;

  const result = cellText.replace(/([☐■□☑])\s*([^☐■□☑]+)/g, (_match, _checkbox: string, optionRaw: string) => {
    const optionClean = optionRaw.replace(/[，,、：:].*/g, "").trim();
    const isSelected = selected.some((s) => optionClean === s || optionClean.startsWith(s) || s.startsWith(optionClean));
    return (isSelected ? "■" : "☐") + " " + optionRaw;
  });

  cell.editAsText().setText(result);
}

function collectElementLines(element: GoogleAppsScript.Document.Element): string[] {
  const type = element.getType();

  if (type === DocumentApp.ElementType.PARAGRAPH) {
    const text = element.asParagraph().getText();
    return text ? [text] : [];
  }
  if (type === DocumentApp.ElementType.LIST_ITEM) {
    const text = element.asListItem().getText();
    return text ? [text] : [];
  }
  if (type === DocumentApp.ElementType.TABLE) {
    const table = element.asTable();
    const lines: string[] = [];
    for (let row = 0; row < table.getNumRows(); row += 1) {
      const tableRow = table.getRow(row);
      for (let col = 0; col < tableRow.getNumCells(); col += 1) {
        const cellText = tableRow.getCell(col).getText();
        if (cellText) lines.push(cellText);
      }
    }
    return lines;
  }
  return [];
}

function expandTableRows(
  body: GoogleAppsScript.Document.Body,
  spec: { marker: string; rows: string[][] }
): void {
  if (!spec.rows.length) return;

  for (let ti = 0; ti < body.getNumChildren(); ti++) {
    const child = body.getChild(ti);
    if (child.getType() !== DocumentApp.ElementType.TABLE) continue;
    const table = child.asTable();

    // Find the template row containing the marker
    let templateRowIdx = -1;
    outerLoop:
    for (let ri = 0; ri < table.getNumRows(); ri++) {
      const row = table.getRow(ri);
      for (let ci = 0; ci < row.getNumCells(); ci++) {
        if (row.getCell(ci).getText().includes(spec.marker)) {
          templateRowIdx = ri;
          break outerLoop;
        }
      }
    }
    if (templateRowIdx < 0) continue;

    const templateRow = table.getRow(templateRowIdx);
    const numCols = templateRow.getNumCells();

    // Capture per-cell formatting from the template row
    type CellStyle = {
      alignment: GoogleAppsScript.Document.HorizontalAlignment | null;
      fontFamily: string | null;
      fontSize: number | null;
      bold: boolean | null;
      paddingTop: number | null;
      paddingBottom: number | null;
      paddingLeft: number | null;
      paddingRight: number | null;
      spacingBefore: number | null;
      spacingAfter: number | null;
      lineSpacing: number | null;
    };
    const cellStyles: CellStyle[] = [];
    for (let ci = 0; ci < numCols; ci++) {
      const cell = templateRow.getCell(ci);
      const para = cell.getNumChildren() > 0 ? cell.getChild(0).asParagraph() : null;
      const text = para ? para.editAsText() : null;
      cellStyles.push({
        alignment: para ? para.getAlignment() : null,
        fontFamily: text ? text.getFontFamily() : null,
        fontSize: text ? text.getFontSize() : null,
        bold: text ? text.isBold() : null,
        paddingTop: cell.getPaddingTop(),
        paddingBottom: cell.getPaddingBottom(),
        paddingLeft: cell.getPaddingLeft(),
        paddingRight: cell.getPaddingRight(),
        spacingBefore: para ? para.getSpacingBefore() : null,
        spacingAfter: para ? para.getSpacingAfter() : null,
        lineSpacing: para ? para.getLineSpacing() : null,
      });
    }
    const templateMinHeight = templateRow.getMinimumHeight();

    // Fill template row (first data row) — setText preserves existing character formatting
    const firstRow = spec.rows[0];
    for (let ci = 0; ci < Math.min(numCols, firstRow.length); ci++) {
      const cell = templateRow.getCell(ci);
      const para = cell.getNumChildren() > 0 ? cell.getChild(0).asParagraph() : null;
      const text = para ? para.editAsText() : cell.editAsText();
      text.setText(firstRow[ci] ?? "");
    }

    // Insert and fill additional rows after the template row
    for (let ri = 1; ri < spec.rows.length; ri++) {
      const newRow = table.insertTableRow(templateRowIdx + ri);
      newRow.setMinimumHeight(templateMinHeight);
      while (newRow.getNumCells() < numCols) {
        newRow.appendTableCell();
      }
      const dataRow = spec.rows[ri];
      for (let ci = 0; ci < Math.min(newRow.getNumCells(), dataRow.length); ci++) {
        const cell = newRow.getCell(ci);
        const style = cellStyles[ci];

        if (style.paddingTop !== null) cell.setPaddingTop(style.paddingTop);
        if (style.paddingBottom !== null) cell.setPaddingBottom(style.paddingBottom);
        if (style.paddingLeft !== null) cell.setPaddingLeft(style.paddingLeft);
        if (style.paddingRight !== null) cell.setPaddingRight(style.paddingRight);

        const para = cell.getNumChildren() > 0
          ? cell.getChild(0).asParagraph()
          : cell.appendParagraph("");
        if (style.alignment) para.setAlignment(style.alignment);
        if (style.spacingBefore !== null) para.setSpacingBefore(style.spacingBefore);
        if (style.spacingAfter !== null) para.setSpacingAfter(style.spacingAfter);
        if (style.lineSpacing !== null) para.setLineSpacing(style.lineSpacing);
        const text = para.editAsText();
        text.setText(dataRow[ci] ?? "");
        if (style.bold !== null) text.setBold(style.bold);
        if (style.fontFamily) text.setFontFamily(style.fontFamily);
        if (style.fontSize) text.setFontSize(style.fontSize);
      }
    }

    return;
  }
}

function normalizeFieldKey(raw: string): string {
  const cleaned = raw.split(/[:：]/)[0]
    .replace(/[()（）]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned && cleaned.length <= 40 ? cleaned : "";
}

function getAllDocBodies(doc: GoogleAppsScript.Document.Document): GoogleAppsScript.Document.Body[] {
  try {
    const docAny = doc as unknown as {
      getTabs(): Array<{ asDocumentTab(): { getBody(): GoogleAppsScript.Document.Body } }>;
    };
    const tabs = docAny.getTabs();
    if (Array.isArray(tabs) && tabs.length > 0) {
      return tabs.map((tab) => tab.asDocumentTab().getBody());
    }
  } catch (_e) {
    // getTabs not available, fall back to main body
  }
  return [doc.getBody()];
}

function escapeRegexForReplace(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
