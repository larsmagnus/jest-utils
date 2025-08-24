/**
 * Jest Performance Analysis Configuration
 *
 * This file provides Jest-specific configuration for performance analysis.
 * The actual configuration logic is handled by src/config/performance.ts
 */

import { getPerformanceConfig } from './lib/tools/performance/configuration'

// Re-export the configuration function for Jest compatibility
export function getConfig() {
  return getPerformanceConfig()
}

// Default export for backward compatibility
export default getPerformanceConfig()
