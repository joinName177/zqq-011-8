/**
 * 统一文本编码 / 转义 / 截断 / 统计工具
 * 所有进入领域模型、界面渲染或导出结构的文本，必须先经过这里的处理。
 */
import { TEXT_LIMITS } from './models';

/** 备注容量（按 Unicode 码点计，emoji 记 1） */
export const MAX_NOTE_CHARS = TEXT_LIMITS.note;
/** 标签容量 */
export const MAX_TAG_CHARS = TEXT_LIMITS.tag;
/** 记录 ID 容量 */
export const MAX_ID_CHARS = TEXT_LIMITS.id;
/** 风向名等短标签容量 */
export const MAX_LABEL_CHARS = TEXT_LIMITS.label;

/**
 * 归一化文本：
 * - NFC 统一 Unicode 组合形式（避免表情、注音/重音组合被拆散成乱码）
 * - \r\n / \r 统一为 \n
 * - 去除除 \n / \t 外的控制字符
 * - 首尾修剪
 */
export function normalizeText(input: unknown): string {
  if (typeof input !== 'string') return '';
  return input
    .normalize('NFC')
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim();
}

/** 按 Unicode 码点统计字数（emoji 与组合字符记 1，而非 UTF-16 代理对长度） */
export function countTextChars(text: string): number {
  return Array.from(text).length;
}

/** 码点安全地裁剪到 maxChars，不加省略号 */
export function sliceText(text: string, maxChars: number): string {
  const chars = Array.from(text);
  if (chars.length <= maxChars) return text;
  return chars.slice(0, Math.max(0, maxChars)).join('');
}

/** 码点安全截断，超长时以省略号结尾 */
export function truncateText(text: string, maxChars: number): string {
  const chars = Array.from(text);
  if (chars.length <= maxChars) return text;
  return chars.slice(0, Math.max(0, maxChars - 1)).join('') + '…';
}

/** 折叠为单行（换行与连续空白归并为单个空格），用于标签、徽标等单行展示 */
export function toSingleLine(text: string): string {
  return text
    .replace(/[ \t\f\v]*\n[ \t\f\v]*/g, ' ')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
};

/** HTML 文本 / 属性统一转义 */
export function escapeHtml(text: string): string {
  return String(text ?? '').replace(/[&<>"']/g, ch => HTML_ESCAPES[ch] ?? ch);
}

/**
 * RFC 4180 CSV 单元格转义：
 * 含逗号、双引号或换行时用双引号包裹，内部双引号翻倍。
 * 多行文本保留在引号内，结构依然合法。
 */
export function escapeCsvCell(value: unknown): string {
  const text = typeof value === 'string' ? value : String(value ?? '');
  return /[",\n\r]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
}
