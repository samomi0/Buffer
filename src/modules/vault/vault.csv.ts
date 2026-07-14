import type { CustomField, VaultEntry } from "./vault.types";

export const VAULT_CSV_TEMPLATE = [
  "type,name,tags,note,ip,dir,osType,url,account,password,customFields",
  'server,Prod API,prod|linux,生产环境主机,10.0.0.8,/srv/api,Ubuntu,,,,' ,
  'password,Github Admin,dev|platform,主账号,,, ,https://github.com,octo-admin,MyStrongPassword123,',
  'custom,支付证书,finance|cert,证书与口令,,,,,,,"[{""key"":""certPath"",""value"":""/keys/pay.pem"",""secret"":false},{""key"":""passphrase"",""value"":""vault-secret"",""secret"":true}]"',
].join("\n");

function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      cells.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  cells.push(current.trim());
  return cells;
}

function parseCsv(csv: string): string[][] {
  const rows: string[][] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < csv.length; i += 1) {
    const char = csv[i];
    if (char === '"') {
      if (inQuotes && csv[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && csv[i + 1] === "\n") {
        i += 1;
      }
      if (current.trim()) {
        rows.push(splitCsvLine(current));
      }
      current = "";
      continue;
    }

    current += char;
  }

  if (current.trim()) {
    rows.push(splitCsvLine(current));
  }

  return rows;
}

function parseTags(value: string): string[] {
  return value
    .split("|")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function parseCustomFields(value: string): CustomField[] {
  if (!value.trim()) {
    return [];
  }

  const parsed = JSON.parse(value) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error("customFields 必须是 JSON 数组");
  }

  return parsed.map((field, index) => {
    const raw = field as Partial<CustomField> | null;
    if (!raw || typeof raw.key !== "string") {
      throw new Error(`customFields 第 ${index + 1} 项缺少 key`);
    }
    return {
      key: raw.key,
      value: typeof raw.value === "string" ? raw.value : "",
      secret: Boolean(raw.secret),
    };
  });
}

export function parseVaultCsv(csv: string): VaultEntry[] {
  // Strip BOM if present
  const clean = csv.charCodeAt(0) === 0xFEFF ? csv.slice(1) : csv;
  const rows = parseCsv(clean);
  if (rows.length === 0) {
    return [];
  }

  const header = rows[0].map((column) => column.trim());
  const required = ["type", "name", "tags", "note", "ip", "dir", "osType", "url", "account", "password", "customFields"];
  const missing = required.filter((column) => !header.includes(column));
  if (missing.length > 0) {
    throw new Error(`CSV 缺少列: ${missing.join(", ")}`);
  }

  return rows.slice(1).filter((row) => row.some((cell) => cell.trim())).map((row, index) => {
    const record = Object.fromEntries(header.map((column, cellIndex) => [column, row[cellIndex] ?? ""]));
    const type = record.type.trim();
    if (type !== "server" && type !== "password" && type !== "custom") {
      throw new Error(`第 ${index + 2} 行 type 非法: ${record.type}`);
    }
    if (!record.name.trim()) {
      throw new Error(`第 ${index + 2} 行缺少 name`);
    }

    return {
      id: crypto.randomUUID(),
      type,
      name: record.name.trim(),
      tags: parseTags(record.tags),
      note: record.note.trim(),
      ip: record.ip.trim(),
      dir: record.dir.trim(),
      osType: record.osType.trim(),
      url: record.url.trim(),
      account: record.account.trim(),
      password: record.password,
      fields: type === "custom" ? parseCustomFields(record.customFields) : [],
    };
  });
}