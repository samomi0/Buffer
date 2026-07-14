/**
 * 纯文本与 TipTap ProseMirror JSON 之间的迁移工具
 */

/** 判断一个值是否为 TipTap doc JSON 结构 */
export function isTipTapDoc(value: unknown): value is object {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return v.type === "doc" && Array.isArray(v.content);
}

/**
 * 将纯文本字符串转为 TipTap doc JSON。
 * 按换行拆分为段落，保留空行。
 */
export function plainTextToTipTapJSON(text: string): object {
  const lines = text.split("\n");
  const content = lines.map((line) => ({
    type: "paragraph",
    content: line ? [{ type: "text", text: line }] : [],
  }));
  return { type: "doc", content };
}

/**
 * 从 TipTap doc JSON 提取纯文本（用于预览/搜索）。
 * 遍历所有 text 节点拼接，段落间用空格分隔。
 */
export function tipTapToPlainText(doc: unknown): string {
  if (!isTipTapDoc(doc)) {
    // 兼容旧的纯字符串备注
    if (typeof doc === "string") return doc;
    return "";
  }
  const parts: string[] = [];
  const walk = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    const n = node as Record<string, unknown>;
    if (n.type === "text" && typeof n.text === "string") {
      parts.push(n.text);
    }
    if (Array.isArray(n.content)) {
      for (const child of n.content) walk(child);
    }
  };
  walk(doc);
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

/**
 * 获取 TipTap doc 的纯文本截断（用于预览）
 */
export function tipTapToPreview(doc: unknown, maxLen = 120): string {
  const text = tipTapToPlainText(doc);
  return text.length > maxLen ? text.slice(0, maxLen) + "…" : text;
}
