/**
 * 统一文本编码层（domain 规则）：
 * 备注、标签与导出天气说明在入库、渲染、导出前，都必须经过这里
 * 统一的规范化（编码）、转义、截断与统计，避免出现乱码、
 * 布局破坏或导出结构无效。
 */

/** 各类文本的统一容量上限（按字素簇计，单个 emoji 记 1） */
export const TEXT_LIMITS = {
  /** 心绪注记（备注）最大长度 */
  note: 200,
  /** 心情标签最大长度 */
  tag: 24,
  /** 时间线药丸上的标签展示长度 */
  pillTag: 8
} as const;

/**
 * 将任意输入规范化为安全文本：
 * 1. 修复孤立代理项（半个 emoji），杜绝 � 乱码；
 * 2. NFC 规范化，统一组合/预组合写法，保证查找与统计口径一致；
 * 3. 统一换行符为 \n；
 * 4. 剔除控制字符与 bidi 方向控制符，防止布局被破坏。
 */
export function normalizeText(input: unknown): string {
  if (input === null || input === undefined) return '';
  let text = String(input);
  text = replaceLoneSurrogates(text);
  text = text.normalize('NFC');
  text = text.replace(/\r\n?/g, '\n');
  text = text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u202A-\u202E\u2066-\u2069]/g, '');
  return text;
}

function replaceLoneSurrogates(text: string): string {
  let out = '';
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = text.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        out += text.charAt(i) + text.charAt(i + 1);
        i++;
      } else {
        out += '\uFFFD';
      }
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      out += '\uFFFD';
    } else {
      out += text.charAt(i);
    }
  }
  return out;
}

interface GraphemeSegmenter {
  segment(text: string): Iterable<{ segment: string }>;
}

let cachedSegmenter: GraphemeSegmenter | null | undefined;

function getSegmenter(): GraphemeSegmenter | null {
  if (cachedSegmenter === undefined) {
    const ctor = (Intl as unknown as { Segmenter?: new (locale: string, options: { granularity: 'grapheme' }) => GraphemeSegmenter }).Segmenter;
    cachedSegmenter = ctor ? new ctor('zh', { granularity: 'grapheme' }) : null;
  }
  return cachedSegmenter;
}

/** 按字素簇切分：ZWJ 序列、修饰符 emoji 不会被切烂 */
export function toGraphemes(text: string): string[] {
  const segmenter = getSegmenter();
  if (segmenter) {
    return Array.from(segmenter.segment(text), part => part.segment);
  }
  // 退化方案：至少按码点切分，不拆代理对
  return Array.from(text);
}

/** 用户感知字符数（emoji 计 1） */
export function graphemeLength(text: string): number {
  return toGraphemes(text).length;
}

/** 按字素簇截断并追加省略号；绝不切烂 emoji */
export function truncateGraphemes(input: unknown, max: number): string {
  const text = normalizeText(input);
  const clusters = toGraphemes(text);
  if (clusters.length <= max) return text;
  return clusters.slice(0, Math.max(0, max)).join('') + '…';
}

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
};

/** HTML 转义：渲染层唯一出口，文本与属性统一走这里 */
export function escapeHtml(input: unknown): string {
  return normalizeText(input).replace(/[&<>'"]/g, ch => HTML_ESCAPES[ch] ?? ch);
}

/** CSV 单元格转义（RFC 4180）：含逗号、引号、换行的单元格加引号，内部引号翻倍 */
export function escapeCsvCell(input: unknown): string {
  const text = normalizeText(input);
  return /[",\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
}

/** 备注清洗：规范化 + 去首尾空白 + 容量截断 */
export function sanitizeNoteText(input: unknown): string {
  return truncateGraphemes(normalizeText(input).trim(), TEXT_LIMITS.note);
}

/** 标签清洗：单行化 + 容量截断 */
export function sanitizeTagText(input: unknown): string {
  const singleLine = normalizeText(input).replace(/[\n\t]+/g, ' ').trim();
  return truncateGraphemes(singleLine, TEXT_LIMITS.tag);
}

export interface TextStats {
  /** 用户感知字符数（emoji 计 1） */
  graphemes: number;
  /** Unicode 码点数 */
  codePoints: number;
  /** UTF-8 字节数 */
  utf8Bytes: number;
  /** 行数 */
  lines: number;
  /** 是否超出给定上限 */
  overLimit: boolean;
}

/** 输入统计：为输入框计数器提供统一口径 */
export function measureText(input: string, limit: number): TextStats {
  const text = normalizeText(input);
  const clusters = toGraphemes(text);
  return {
    graphemes: clusters.length,
    codePoints: Array.from(text).length,
    utf8Bytes: utf8ByteLength(text),
    lines: text === '' ? 0 : text.split('\n').length,
    overLimit: clusters.length > limit
  };
}

function utf8ByteLength(text: string): number {
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(text).length;
  }
  return unescape(encodeURIComponent(text)).length;
}
