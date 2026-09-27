import { MoodRecord, SynopticChartData } from './models';
import { escapeCsvCell, normalizeText } from './text-encoding';

export type WeatherExportFormat = 'csv' | 'json';

export interface WeatherExportPayload {
  filename: string;
  mimeType: string;
  content: string;
  recordCount: number;
}

const CSV_HEADERS = [
  '日期',
  '心情标签',
  '对流强度',
  '心绪注记',
  '气压(hPa)',
  '温度(°C)',
  '湿度(%)',
  '风速(km/h)',
  '风向'
];

function recordToCsvRow(record: MoodRecord): string {
  return [
    escapeCsvCell(record.date),
    escapeCsvCell(record.tag),
    escapeCsvCell(String(record.intensity)),
    escapeCsvCell(record.note),
    escapeCsvCell(String(record.pressureHpa)),
    escapeCsvCell(String(record.temperatureC)),
    escapeCsvCell(String(record.humidityPercent)),
    escapeCsvCell(String(record.windSpeedKmH)),
    escapeCsvCell(record.windDirectionName)
  ].join(',');
}

/**
 * 基于当前界面同一份 chartData 快照构建导出内容，
 * 保证预览、详情与导出结果一致；所有文本字段统一经过
 * 规范化与转义，含表情、引号、多行文本时导出结构依然有效。
 */
export function buildWeatherExport(chart: SynopticChartData, format: WeatherExportFormat): WeatherExportPayload {
  const records = chart.records;
  const dateStamp = normalizeText(chart.generatedDate).replace(/[^\d]+/g, '-').replace(/^-+|-+$/g, '') || 'snapshot';

  if (format === 'json') {
    const payload = {
      chartId: normalizeText(chart.chartId),
      generatedDate: normalizeText(chart.generatedDate),
      pressureSystemType: chart.pressureSystemType,
      metSummary: normalizeText(chart.metSummary),
      averagePressure: chart.averagePressure,
      monsoon: {
        vectorName: normalizeText(chart.monsoon.vectorName),
        originSource: normalizeText(chart.monsoon.originSource),
        frequencyDays: chart.monsoon.frequencyDays,
        flowSpeed: normalizeText(chart.monsoon.flowSpeed),
        windAngle: chart.monsoon.windAngle,
        weatherImpact: normalizeText(chart.monsoon.weatherImpact),
        upcomingForecast: normalizeText(chart.monsoon.upcomingForecast)
      },
      alerts: chart.alerts.map(alert => ({
        id: normalizeText(alert.id),
        level: alert.level,
        type: normalizeText(alert.type),
        title: normalizeText(alert.title),
        issuedTime: normalizeText(alert.issuedTime),
        triggerCause: normalizeText(alert.triggerCause),
        defenseProtocol: alert.defenseProtocol.map(step => normalizeText(step))
      })),
      records: records.map(record => ({
        ...record,
        tag: normalizeText(record.tag),
        note: normalizeText(record.note),
        windDirectionName: normalizeText(record.windDirectionName)
      }))
    };
    return {
      filename: `mood-weather-${dateStamp}.json`,
      mimeType: 'application/json',
      content: JSON.stringify(payload, null, 2),
      recordCount: records.length
    };
  }

  // CSV：严格的表头 + 数据行，单元格按 RFC 4180 转义，行尾 \r\n
  const rows = [CSV_HEADERS.map(escapeCsvCell).join(','), ...records.map(recordToCsvRow)];
  return {
    filename: `mood-weather-${dateStamp}.csv`,
    mimeType: 'text/csv',
    content: rows.join('\r\n'),
    recordCount: records.length
  };
}
