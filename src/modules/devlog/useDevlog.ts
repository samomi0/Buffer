import { invoke } from "@tauri-apps/api/core";
import type { DevlogNote, DevlogTag } from "./devlog.types";

export async function loadAllNotes(dataDir: string): Promise<DevlogNote[]> {
  const raw: string = await invoke("list_devlog_notes", { dataDir });
  return JSON.parse(raw) as DevlogNote[];
}

export async function loadTags(dataDir: string): Promise<DevlogTag[]> {
  const raw: string = await invoke("read_devlog_tags", { dataDir });
  return JSON.parse(raw) as DevlogTag[];
}

export async function saveNote(dataDir: string, note: DevlogNote): Promise<void> {
  await invoke("write_devlog_note", {
    dataDir,
    id: note.id,
    json: JSON.stringify(note),
  });
}

export async function deleteNote(dataDir: string, id: string): Promise<void> {
  await invoke("delete_devlog_note", { dataDir, id });
}

export async function saveTags(dataDir: string, tags: DevlogTag[]): Promise<void> {
  await invoke("write_devlog_tags", {
    dataDir,
    json: JSON.stringify(tags),
  });
}

/* ── 图片存储 ─────────────────────────────────────────────────── */

/** 将 base64 图片保存为文件，返回相对路径（如 "images/abc-123.png"） */
export async function saveDevlogImage(
  dataDir: string,
  noteId: string,
  dataUrl: string,
): Promise<string> {
  return await invoke<string>("write_devlog_image", { dataDir, noteId, dataUrl });
}

/** 根据相对路径读取图片，返回完整 data URL */
export async function loadDevlogImage(
  dataDir: string,
  imagePath: string,
): Promise<string> {
  return await invoke<string>("read_devlog_image", { dataDir, imagePath });
}

/** 删除笔记关联的所有图片 */
export async function deleteNoteImages(dataDir: string, noteId: string): Promise<void> {
  await invoke("delete_devlog_note_images", { dataDir, noteId });
}
