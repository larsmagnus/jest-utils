/**
 * Jest Memory Leak Detection Configuration
 *
 * This file provides Jest-specific configuration for memory leak detection.
 * The actual configuration logic is handled by src/config/leak-detection.ts
 */

import { getLeakDetectionConfig } from './src/config/leak-detection'

// Re-export the configuration function for Jest compatibility
export function getConfig() {
  return getLeakDetectionConfig()
}

// Default export for backward compatibility
export default getLeakDetectionConfig()
