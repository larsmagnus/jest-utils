/**
 * Performance Reporting Configuration
 *
 * Centralized configuration for performance analysis and reporting
 */

export interface PerformanceConfig {
  output: {
    outputDir: string
    htmlReport: boolean
    jsonReport: boolean
    flamegraphReport: boolean
  }

  profiling: {
    enableCPUProfiling: boolean
    enableMemoryProfiling: boolean
    sampleInterval: number
    minFrameSize: number
  }

  thresholds: {
    slowTestThreshold: number
    memoryThreshold: number
    slowSuiteThreshold: number
    memoryLeakThreshold: number
  }

  trending: {
    enabled: boolean
    maxHistoryRuns: number
    enableRegressionDetection: boolean
    regressionThreshold: number
  }

  flamegraph: {
    width: number
    height: number
    cellHeight: number
    transitionDuration: number
    colorScheme: 'warm' | 'cool' | 'rainbow'
  }

  analysis: {
    enableBottleneckDetection: boolean
    enableRecommendations: boolean
    topSlowTests: number
    topMemoryTests: number
  }

  reporting: {
    includeSourceMaps: boolean
    enableTimeline: boolean
    includeGCStats: boolean
    enableComparison: boolean
  }
}

const baseConfig: PerformanceConfig = {
  output: {
    outputDir: 'reports/performance',
    htmlReport: true,
    jsonReport: true,
    flamegraphReport: true,
  },

  profiling: {
    enableCPUProfiling: true,
    enableMemoryProfiling: true,
    sampleInterval: 1000,
    minFrameSize: 5,
  },

  thresholds: {
    slowTestThreshold: 1000,
    memoryThreshold: 50,
    slowSuiteThreshold: 5000,
    memoryLeakThreshold: 10,
  },

  trending: {
    enabled: true,
    maxHistoryRuns: 100,
    enableRegressionDetection: true,
    regressionThreshold: 20,
  },

  flamegraph: {
    width: 1200,
    height: 600,
    cellHeight: 18,
    transitionDuration: 750,
    colorScheme: 'warm',
  },

  analysis: {
    enableBottleneckDetection: true,
    enableRecommendations: true,
    topSlowTests: 10,
    topMemoryTests: 5,
  },

  reporting: {
    includeSourceMaps: false,
    enableTimeline: true,
    includeGCStats: true,
    enableComparison: true,
  },
}

type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P]
}

const environmentConfigs: Record<string, DeepPartial<PerformanceConfig>> = {
  development: {
    profiling: {
      sampleInterval: 500,
      enableMemoryProfiling: true,
    },
    flamegraph: {
      width: 1600,
      height: 800,
    },
  },

  ci: {
    profiling: {
      enableCPUProfiling: false,
      enableMemoryProfiling: true,
    },
    thresholds: {
      slowTestThreshold: 500,
      memoryThreshold: 25,
    },
  },

  production: {
    profiling: {
      enableCPUProfiling: false,
      enableMemoryProfiling: false,
    },
    output: {
      flamegraphReport: false,
    },
  },
}

function deepMerge<T extends Record<string, any>>(
  target: T,
  source: DeepPartial<T>
): T {
  const result = { ...target }

  for (const key in source) {
    if (
      source[key] &&
      typeof source[key] === 'object' &&
      !Array.isArray(source[key])
    ) {
      result[key] = deepMerge(result[key] || ({} as any), source[key] as any)
    } else if (source[key] !== undefined) {
      result[key] = source[key] as any
    }
  }

  return result
}

export function getPerformanceConfig(environment?: string): PerformanceConfig {
  const env = environment || process.env.NODE_ENV || 'development'
  const envConfig = environmentConfigs[env] || {}

  return deepMerge(baseConfig, envConfig)
}

export default getPerformanceConfig
