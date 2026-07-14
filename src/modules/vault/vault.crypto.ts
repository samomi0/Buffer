import type { VaultData } from "./vault.types";
import { VAULT_SALT } from "./vault.salt";

const SALT = new TextEncoder().encode(VAULT_SALT);
const IV_LENGTH = 12; // bytes for AES-GCM
const ITERATIONS = 200_000;

interface VaultEnvelope {
  version: 1;
  algorithm: "AES-GCM";
  kdf: "PBKDF2";
  iterations: number;
  iv: string;
  cipher: string;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const normalized = value.replace(/\s+/g, "").trim();
  const binary = atob(normalized);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function normalizeVaultData(value: unknown): VaultData {
  const raw = value as Partial<VaultData> | null;
  const entries = Array.isArray(raw?.entries) ? raw.entries : [];
  const tags = Array.isArray(raw?.tags)
    ? raw.tags.filter((tag): tag is string => typeof tag === "string")
    : [];
  return {
    entries: entries.map((entry) => ({
      ...entry,
      id: typeof entry.id === "string" && entry.id ? entry.id : crypto.randomUUID(),
      name: typeof entry.name === "string" ? entry.name : "未命名条目",
      type:
        entry.type === "server" || entry.type === "password" || entry.type === "custom"
          ? entry.type
          : "custom",
      note: typeof entry.note === "string" ? entry.note : "",
      tags: Array.isArray(entry.tags)
        ? entry.tags.filter((tag): tag is string => typeof tag === "string")
        : [],
      fields: Array.isArray(entry.fields)
        ? entry.fields.map((field) => ({
            key: typeof field.key === "string" ? field.key : "",
            value: typeof field.value === "string" ? field.value : "",
            secret: Boolean(field.secret),
          }))
        : [],
    })),
    tags,
  };
}

async function decryptPackedBase64(
  cipher: string,
  key: CryptoKey
): Promise<VaultData> {
  const bytes = base64ToBytes(cipher);
  const iv = bytes.slice(0, IV_LENGTH);
  const cipherBuf = bytes.slice(IV_LENGTH);
  const plainBuf = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    cipherBuf
  );
  return normalizeVaultData(JSON.parse(new TextDecoder().decode(plainBuf)));
}

const DEFAULT_ITERATIONS = 200_000;

function isEnvelope(value: unknown): value is VaultEnvelope {
  const raw = value as Partial<VaultEnvelope> | null;
  return raw?.version === 1 && typeof raw.iv === "string" && typeof raw.cipher === "string";
}

/** 从密文信封中提取迭代次数，如果无法解析则返回默认值 */
export function readEnvelopeIterations(cipher: string): number {
  const raw = cipher.trim();
  if (!raw.startsWith("{")) return DEFAULT_ITERATIONS;
  try {
    const parsed = JSON.parse(raw) as Partial<VaultEnvelope>;
    return typeof parsed.iterations === "number" && parsed.iterations > 0
      ? parsed.iterations
      : DEFAULT_ITERATIONS;
  } catch {
    return DEFAULT_ITERATIONS;
  }
}

export async function deriveKey(
  masterPassword: string,
  iterations?: number
): Promise<CryptoKey> {
  const raw = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(masterPassword),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: SALT, iterations: iterations ?? DEFAULT_ITERATIONS, hash: "SHA-256" },
    raw,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encryptVault(
  data: VaultData,
  key: CryptoKey
): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const plaintext = new TextEncoder().encode(JSON.stringify(data));
  const cipherBuf = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    plaintext
  );
  const envelope: VaultEnvelope = {
    version: 1,
    algorithm: "AES-GCM",
    kdf: "PBKDF2",
    iterations: ITERATIONS,
    iv: bytesToBase64(iv),
    cipher: bytesToBase64(new Uint8Array(cipherBuf)),
  };
  return JSON.stringify(envelope, null, 2);
}

export async function decryptVault(
  cipher: string,
  key: CryptoKey
): Promise<VaultData> {
  const raw = cipher.trim();
  if (!raw) {
    return normalizeVaultData({ entries: [], tags: [] });
  }

  if (raw.startsWith("{") || raw.startsWith("[")) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error("文件损坏：内容不是有效的 JSON");
    }

    if (isEnvelope(parsed)) {
      const iv = base64ToBytes(parsed.iv).slice();
      const cipherBytes = base64ToBytes(parsed.cipher).slice();
      try {
        const plainBuf = await crypto.subtle.decrypt(
          { name: "AES-GCM", iv },
          key,
          cipherBytes
        );
        return normalizeVaultData(JSON.parse(new TextDecoder().decode(plainBuf)));
      } catch (err) {
        const msg = String(err);
        if (msg.includes("OperationError")) {
          throw new Error("密码错误：AES-GCM 解密失败，密码不正确（OperationError）");
        }
        throw new Error(`AES-GCM 解密异常：${msg}`);
      }
    }
    return normalizeVaultData(parsed);
  }

  try {
    return await decryptPackedBase64(raw, key);
  } catch (err) {
    const msg = String(err);
    if (msg.includes("OperationError")) {
      throw new Error("密码错误：打包格式 AES-GCM 解密失败，密码不正确（OperationError）");
    }
    throw new Error(`打包格式解密异常：${msg}`);
  }
}
