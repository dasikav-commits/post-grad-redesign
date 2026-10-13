import "server-only";

import { deflateRawSync } from "node:zlib";

/**
 * Tiny dependency-free .xlsx writer.
 *
 * An .xlsx file is a ZIP of a handful of XML parts, so we build exactly the
 * parts Excel needs (workbook + one worksheet + minimal styles) and pack them
 * with a small ZIP writer on top of node:zlib. Cells are written as inline
 * strings / numbers, which keeps the output small and avoids a shared-string
 * table.
 *
 * Only what the portal needs is supported: one sheet, a bold header row and
 * optional column widths.
 */

export type CellValue = string | number | boolean | null | undefined;

export type Sheet = {
  /** Worksheet name (max 31 chars, no []:*?/\ ). */
  name: string;
  /** First row is treated as the header and rendered bold. */
  headers: string[];
  rows: CellValue[][];
  /** Optional column widths, in Excel "characters" units. */
  widths?: number[];
};

// ---- ZIP ------------------------------------------------------------------

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c;
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function dosDateTime(date: Date): { time: number; date: number } {
  const year = Math.max(1980, date.getFullYear());
  return {
    time:
      (date.getHours() << 11) |
      (date.getMinutes() << 5) |
      (date.getSeconds() >> 1),
    date:
      ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  };
}

type ZipEntry = { name: string; contents: Buffer };

function zip(entries: ZipEntry[]): Buffer {
  const { time, date } = dosDateTime(new Date());
  const chunks: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBuf = Buffer.from(entry.name, "utf8");
    const compressed = deflateRawSync(entry.contents, { level: 9 });
    const crc = crc32(entry.contents);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); // local file header signature
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt16LE(0x0800, 6); // flags: UTF-8 names
    local.writeUInt16LE(8, 8); // method: deflate
    local.writeUInt16LE(time, 10);
    local.writeUInt16LE(date, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(entry.contents.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28); // extra length

    chunks.push(local, nameBuf, compressed);

    const dir = Buffer.alloc(46);
    dir.writeUInt32LE(0x02014b50, 0); // central directory signature
    dir.writeUInt16LE(20, 4); // version made by
    dir.writeUInt16LE(20, 6); // version needed
    dir.writeUInt16LE(0x0800, 8); // flags
    dir.writeUInt16LE(8, 10); // method
    dir.writeUInt16LE(time, 12);
    dir.writeUInt16LE(date, 14);
    dir.writeUInt32LE(crc, 16);
    dir.writeUInt32LE(compressed.length, 20);
    dir.writeUInt32LE(entry.contents.length, 24);
    dir.writeUInt16LE(nameBuf.length, 28);
    dir.writeUInt16LE(0, 30); // extra
    dir.writeUInt16LE(0, 32); // comment
    dir.writeUInt16LE(0, 34); // disk number
    dir.writeUInt16LE(0, 36); // internal attrs
    dir.writeUInt32LE(0, 38); // external attrs
    dir.writeUInt32LE(offset, 42); // local header offset
    central.push(dir, nameBuf);

    offset += local.length + nameBuf.length + compressed.length;
  }

  const centralBuf = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralBuf.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([...chunks, centralBuf, end]);
}

// ---- SpreadsheetML --------------------------------------------------------

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
    // Strip control characters XML 1.0 cannot represent.
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "");
}

function columnName(index: number): string {
  let n = index + 1;
  let name = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    name = String.fromCharCode(65 + rem) + name;
    n = Math.floor((n - 1) / 26);
  }
  return name;
}

function safeSheetName(name: string): string {
  return (name || "Sheet1").replace(/[[\]:*?/\\]/g, " ").slice(0, 31);
}

function cellXml(ref: string, value: CellValue, style: number): string {
  const s = style ? ` s="${style}"` : "";
  if (value === null || value === undefined || value === "") {
    return `<c r="${ref}"${s}/>`;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return `<c r="${ref}"${s}><v>${value}</v></c>`;
  }
  if (typeof value === "boolean") {
    return `<c r="${ref}"${s} t="b"><v>${value ? 1 : 0}</v></c>`;
  }
  const text = String(value);
  // Keep leading/trailing whitespace intact.
  return `<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${escapeXml(text)}</t></is></c>`;
}

function sheetXml(sheet: Sheet): string {
  const columnCount = Math.max(
    sheet.headers.length,
    ...sheet.rows.map((r) => r.length),
    0,
  );

  const cols =
    sheet.widths && sheet.widths.length
      ? `<cols>${sheet.widths
          .map(
            (w, i) =>
              `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`,
          )
          .join("")}</cols>`
      : "";

  const rows: string[] = [];
  rows.push(
    `<row r="1">${sheet.headers
      .map((h, i) => cellXml(`${columnName(i)}1`, h, 1))
      .join("")}</row>`,
  );
  sheet.rows.forEach((row, r) => {
    const rowNum = r + 2;
    const cells: string[] = [];
    for (let i = 0; i < columnCount; i++) {
      cells.push(cellXml(`${columnName(i)}${rowNum}`, row[i], 0));
    }
    rows.push(`<row r="${rowNum}">${cells.join("")}</row>`);
  });

  const lastRef = `${columnName(Math.max(columnCount - 1, 0))}${sheet.rows.length + 1}`;
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:${lastRef}"/>${cols}<sheetData>${rows.join("")}</sheetData></worksheet>`;
}

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`;

const ROOT_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;

const WORKBOOK_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;

const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><color theme="1"/><name val="Calibri"/><family val="2"/></font><font><b/><sz val="11"/><color theme="1"/><name val="Calibri"/><family val="2"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;

/** Build a single-sheet .xlsx workbook. */
export function buildXlsx(sheet: Sheet): Buffer {
  const name = safeSheetName(sheet.name);
  const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${escapeXml(name)}" sheetId="1" r:id="rId1"/></sheets></workbook>`;

  return zip([
    { name: "[Content_Types].xml", contents: Buffer.from(CONTENT_TYPES, "utf8") },
    { name: "_rels/.rels", contents: Buffer.from(ROOT_RELS, "utf8") },
    { name: "xl/workbook.xml", contents: Buffer.from(workbook, "utf8") },
    { name: "xl/_rels/workbook.xml.rels", contents: Buffer.from(WORKBOOK_RELS, "utf8") },
    { name: "xl/styles.xml", contents: Buffer.from(STYLES, "utf8") },
    { name: "xl/worksheets/sheet1.xml", contents: Buffer.from(sheetXml(sheet), "utf8") },
  ]);
}

export const XLSX_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/** Sanitise a string for use in a Content-Disposition filename. */
export function safeFileName(name: string, ext = "xlsx"): string {
  const base = name
    .replace(/[^a-zA-Z0-9-_ ]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .toLowerCase();
  return `${base || "export"}.${ext}`;
}
