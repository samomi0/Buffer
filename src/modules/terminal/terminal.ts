import { invoke } from "@tauri-apps/api/core";

export interface TermCreateOptions {
  shell?: string;
  cwd?: string;
  cols: number;
  rows: number;
}

export interface TermOutputEvent {
  id: string;
  data: string;
}

export async function termDetectShell(): Promise<string> {
  return invoke<string>("term_detect_shell");
}

export async function termCreate(id: string, opts: TermCreateOptions): Promise<void> {
  await invoke("term_create", {
    id,
    shell: opts.shell ?? "",
    cwd: opts.cwd ?? "",
    cols: opts.cols,
    rows: opts.rows,
  });
}

export async function termWrite(id: string, data: string): Promise<void> {
  await invoke("term_write", { id, data });
}

export async function termResize(id: string, cols: number, rows: number): Promise<void> {
  await invoke("term_resize", { id, cols, rows });
}

export async function termClose(id: string): Promise<void> {
  await invoke("term_close", { id });
}

export async function termList(): Promise<string[]> {
  return invoke<string[]>("term_list");
}

export async function termAttach(id: string): Promise<string> {
  return invoke<string>("term_attach", { id });
}
