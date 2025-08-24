import fs from 'fs/promises'
import path from 'path'

export type ReportFormat = 'json' | 'csv'

export interface ExporterOptions<T extends Record<string, unknown>, U = T[]> {
  /**
   * Path to output the report file.
   */
  outputPath: string
  /**
   * Format of the report: 'json' or 'csv'.
   */
  format: ReportFormat
  /**
   * Optional function to select/transform the data before output.
   */
  select?: (data: T[]) => U
}

/**
 * Generic export collector for Jest reporter data, with JSON/CSV output support.
 *
 * @example usage
 *
 * ```ts
 * const collector = new Exporter({ outputPath: 'reports/my-report.json', format: 'json' });
 * collector.add({ ... });
 * await collector.writeReport();
 * ```
 */
export class Exporter<T extends Record<string, unknown>, U = T[]> {
  private data: T[] = []
  private options: ExporterOptions<T, U>

  constructor(options: ExporterOptions<T, U>) {
    this.options = options
  }

  /**
   * Add a data entry (e.g., from onTestResult, onRunStart, etc).
   */
  add(entry: T): void {
    this.data.push(entry)
  }

  /**
   * Output the collected data to the configured file.
   */
  async writeReport(): Promise<void> {
    const { outputPath, format, select } = this.options
    const outData = select ? select(this.data) : this.data
    await fs.mkdir(path.dirname(outputPath), { recursive: true })

    if (format === 'json') {
      await fs.writeFile(outputPath, JSON.stringify(outData, null, 2), 'utf8')
    } else if (format === 'csv') {
      // Only allow CSV for arrays of objects
      if (!Array.isArray(outData)) {
        throw new Error('CSV output requires an array of objects')
      }
      const csv = toCSV(outData as T[])
      await fs.writeFile(outputPath, csv, 'utf8')
    } else {
      throw new Error(`Unsupported format: ${format}`)
    }
  }

  /**
   * Get the collected data (for custom use).
   */
  getData(): T[] {
    return this.data
  }
}

/**
 * Convert an array of objects to CSV string.
 */
export function toCSV<T extends Record<string, unknown>>(data: T[]): string {
  if (!Array.isArray(data) || data.length === 0) return ''

  const keys = Object.keys(data[0]) as Array<keyof T & string>
  const escape = (v: unknown) => {
    if (typeof v === 'string') {
      if (v.includes(',') || v.includes('"') || v.includes('\n')) {
        return `"${v.replace(/"/g, '""')}"`
      }
      return v
    }
    if (typeof v === 'object' && v !== null) {
      return `"${JSON.stringify(v).replace(/"/g, '""')}"`
    }
    return v
  }

  const header = keys.join(',')
  const rows = data.map((row) => keys.map((k) => escape(row[k])).join(','))

  return [header, ...rows].join('\n')
}
