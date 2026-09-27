import type { WeatherExportPayload } from '../core/weather-export';

/**
 * 触发浏览器下载：统一 UTF-8 编码；
 * CSV 前置 BOM，避免 Excel 等工具打开时出现乱码。
 */
export function downloadWeatherExport(payload: WeatherExportPayload): void {
  const needsBom = payload.mimeType === 'text/csv';
  const content = needsBom ? '\uFEFF' + payload.content : payload.content;
  const blob = new Blob([content], { type: `${payload.mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = payload.filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
