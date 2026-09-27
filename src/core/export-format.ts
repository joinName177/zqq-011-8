import type { MoodRecord, SynopticChartData } from './models';
import { escapeCsvCell, normalizeText, truncateText, MAX_NOTE_CHARS, MAX_TAG_CHARS } from './text-encoding';

/** 导出文件统一使用的字符集声明 */
export const EXPORT_CHARSET = 'utf-8';
/** UTF-8 BOM：让 Excel 等工具正确识别中文与 emoji，避免乱码 */
const UTF8_BOM = '\uFEFF';

export interface ExportPayload {
  filename: string;
  mimeType: string;
  content: string;
}

function exportStamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
}

/** 单条记录序列化为导出安全的纯数据（与界面看到的快照一致） */
function recordToExportRow(r: MoodRecord) {
  return {
    id: normalizeText(r.id),
    date: normalizeText(r.date),
    tag: truncateText(normalizeText(r.tag), MAX_TAG_CHARS),
    intensity: r.intensity,
    note: truncateText(normalizeText(r.note), MAX_NOTE_CHARS),
    pressureHpa: r.pressureHpa,
    temperatureC: r.temperatureC,
    humidityPercent: r.humidityPercent,
    windSpeedKmH: r.windSpeedKmH,
    windDirectionDeg: r.windDirectionDeg,
    windDirectionName: normalizeText(r.windDirectionName)
  };
}

/**
 * 导出 JSON：基于当前综观图快照，结构固定、JSON.stringify 保证转义合法；
 * 多行、引号、emoji 均以 UTF-8 原样保留。
 */
export function buildWeatherJsonExport(chart: SynopticChartData): ExportPayload {
  const payload = {
    format: 'mood-meteorology-export',
    charset: EXPORT_CHARSET,
    chartId: chart.chartId,
    generatedDate: chart.generatedDate,
    pressureSystemType: chart.pressureSystemType,
    averagePressure: chart.averagePressure,
    metSummary: chart.metSummary,
    records: chart.records.map(recordToExportRow)
  };
  return {
    filename: `mood-weather-${exportStamp()}.json`,
    mimeType: 'application/json;charset=utf-8',
    content: JSON.stringify(payload, null, 2)
  };
}

/**
 * 导出 CSV（RFC 4180）：
 * - UTF-8 BOM 防中文/emoji 乱码
 * - 含逗号、引号、换行的单元格统一加引号转义，多行备注不会破坏行结构
 */
export function buildWeatherCsvExport(chart: SynopticChartData): ExportPayload {
  const headers = [
    '日期', '气象标签', '强度(1-10)', '备注',
    '气压(hPa)', '温度(°C)', '湿度(%)', '风速(km/h)', '风向', '记录ID'
  ];
  const lines = [headers.map(escapeCsvCell).join(',')];
  for (const r0 of chart.records) {
    const r = recordToExportRow(r0);
    lines.push([
      r.date,
      r.tag,
      String(r.intensity),
      r.note,
      String(r.pressureHpa),
      String(r.temperatureC),
      String(r.humidityPercent),
      String(r.windSpeedKmH),
      r.windDirectionName,
      r.id
    ].map(escapeCsvCell).join(','));
  }
  return {
    filename: `mood-weather-${exportStamp()}.csv`,
    mimeType: 'text/csv;charset=utf-8',
    content: UTF8_BOM + lines.join('\r\n') + '\r\n'
  };
}
