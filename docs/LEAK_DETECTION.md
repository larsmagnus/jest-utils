# Memory Leak Detection for Jest Tests

This project includes comprehensive memory leak detection utilities to help identify tests that don't properly clean up resources, leading to memory leaks and performance degradation.

## Features

### 🔍 **Automatic Detection**

- **Memory Usage Monitoring**: Tracks heap growth and memory consumption per test
- **Global Variable Tracking**: Identifies new global variables created during tests
- **Timer Leak Detection**: Finds uncleaned setTimeout/setInterval calls
- **Event Listener Tracking**: Detects unremoved event listeners
- **Promise Monitoring**: Identifies pending/unresolved promises

### 📊 **Comprehensive Reporting**

- Real-time leak warnings during test execution
- End-of-run summary with leak statistics
- Detailed analysis with actionable recommendations
- Heap snapshot generation for advanced debugging
- Configurable thresholds and filtering

### ⚙️ **Flexible Configuration**

- Environment-specific settings (dev, CI, production)
- Customizable memory thresholds and detection rules
- Test filtering with include/exclude patterns
- Multiple integration options (reporter, setup file, manual)

## Quick Start

### Option 1: Automatic Integration (Recommended)

Add to your `jest.config.ts`:

```javascript
module.exports = {
  setupFilesAfterEnv: ['<rootDir>/jest-setup-leak-detection.ts'],
  // ... other config
}
```

### Option 2: Reporter Integration

Configure in Jest reporter options:

```javascript
module.exports = {
  reporters: [
    'default',
    [
      '<rootDir>/reporters/custom-reporter.ts',
      {
        enableLeakDetection: true,
        leakDetection: {
          memoryThresholdMB: 25,
          generateHeapSnapshots: false,
          verbose: true,
        },
      },
    ],
  ],
}
```

### Option 3: Manual Integration

```javascript
const LeakDetector = require('./src/leak-detector.ts')

describe('My Test Suite', () => {
  const leakDetector = new LeakDetector()
  let testId

  beforeEach(() => {
    testId = leakDetector.startTest(
      expect.getState().currentTestName,
      __filename
    )
  })

  afterEach(() => {
    leakDetector.finishTest(testId, 'passed')
  })

  test('my test', () => {
    // Your test code here
  })
})
```

## Configuration

### Environment Variables

```bash
# Memory thresholds
LEAK_MEMORY_THRESHOLD_MB=25
LEAK_HEAP_GROWTH_THRESHOLD=0.15

# Reporting options
LEAK_DETECTION_VERBOSE=true
GENERATE_HEAP_SNAPSHOTS=true
FAIL_ON_LEAKS=false

# Node environment
NODE_ENV=development|ci|production
```

### Configuration File

Use `leak-detection.config.ts` for detailed configuration:

```javascript
module.exports = {
  development: {
    memoryThresholdMB: 50,
    heapGrowthThreshold: 0.25,
    verbose: true,
    generateHeapSnapshots: false,
  },
  ci: {
    memoryThresholdMB: 30,
    heapGrowthThreshold: 0.15,
    verbose: false,
    generateHeapSnapshots: true,
  },
  // ... more environments
}
```

## Common Leak Patterns & Solutions

### 🌐 **Global Variable Leaks**

**Problem:**

```javascript
test('creates global leak', () => {
  global.testData = new Array(100000).fill('data')
  // Missing cleanup!
})
```

**Solution:**

```javascript
test('properly cleaned', () => {
  global.testData = new Array(100000).fill('data')

  // Cleanup in test or afterEach
  delete global.testData
})
```

### ⏰ **Timer Leaks**

**Problem:**

```javascript
test('timer leak', () => {
  setTimeout(() => console.log('leak'), 10000)
  setInterval(() => console.log('leak'), 1000)
  // Missing clearTimeout/clearInterval!
})
```

**Solution:**

```javascript
test('timer cleanup', () => {
  const timeout = setTimeout(() => console.log('clean'), 10000)
  const interval = setInterval(() => console.log('clean'), 1000)

  // Cleanup
  clearTimeout(timeout)
  clearInterval(interval)
})
```

### 🎧 **Event Listener Leaks**

**Problem:**

```javascript
test('listener leak', () => {
  const handler = () => console.log('event')
  element.addEventListener('click', handler)
  // Missing removeEventListener!
})
```

**Solution:**

```javascript
test('listener cleanup', () => {
  const handler = () => console.log('event')
  element.addEventListener('click', handler)

  // Cleanup
  element.removeEventListener('click', handler)
})
```

### 🏗️ **DOM Node Leaks**

**Problem:**

```javascript
test('DOM leak', () => {
  const nodes = []
  for (let i = 0; i < 100; i++) {
    nodes.push(document.createElement('div'))
  }
  // Nodes remain in memory!
})
```

**Solution:**

```javascript
test('DOM cleanup', () => {
  const nodes = []
  for (let i = 0; i < 100; i++) {
    const node = document.createElement('div')
    nodes.push(node)
  }

  // Cleanup
  nodes.forEach((node) => {
    if (node.parentNode) {
      node.parentNode.removeChild(node)
    }
  })
})
```

### 🤝 **Promise Leaks**

**Problem:**

```javascript
test('promise leak', () => {
  new Promise((resolve) => {
    // Never resolves - memory leak!
    setTimeout(resolve, 30000)
  })
})
```

**Solution:**

```javascript
test('promise cleanup', async () => {
  const controller = new AbortController()

  const promise = new Promise((resolve, reject) => {
    const timeout = setTimeout(resolve, 1000)
    controller.signal.addEventListener('abort', () => {
      clearTimeout(timeout)
      reject(new Error('Aborted'))
    })
  })

  try {
    await promise
  } finally {
    controller.abort() // Cleanup
  }
})
```

## Best Practices

### 🧹 **Cleanup Patterns**

```javascript
describe('Proper cleanup patterns', () => {
  let resources = []

  afterEach(() => {
    // Clean up all resources after each test
    resources.forEach((resource) => {
      if (resource.cleanup) resource.cleanup()
      if (resource.destroy) resource.destroy()
      if (resource.close) resource.close()
    })
    resources = []

    // Clear global test data
    delete global.testData
    delete global.testCache
  })

  test('with proper resource tracking', () => {
    const timer = setTimeout(() => {}, 1000)
    const listener = () => {}

    // Track resources for cleanup
    resources.push({
      cleanup: () => clearTimeout(timer),
    })

    element.addEventListener('click', listener)
    resources.push({
      cleanup: () => element.removeEventListener('click', listener),
    })
  })
})
```

### 🎯 **Test Organization**

```javascript
// Good: Group related tests and shared cleanup
describe('UserService', () => {
  let userService

  beforeEach(() => {
    userService = new UserService()
  })

  afterEach(() => {
    userService.cleanup()
    userService = null
  })
})
```

### 🔧 **Mock Cleanup**

```javascript
describe('With mocks', () => {
  afterEach(() => {
    jest.clearAllMocks()
    jest.clearAllTimers()
    jest.restoreAllMocks()
  })
})
```

## Troubleshooting

### Common Issues

1. **False Positives**: Use exclude patterns for performance tests
2. **Multi-project Setup**: Global isolation may affect detection
3. **CI Environment**: Enable heap snapshots for detailed analysis
4. **Large Test Suites**: Adjust memory thresholds accordingly

### Debug Commands

```bash
# Enable verbose logging
LEAK_DETECTION_VERBOSE=true npm test

# Generate heap snapshots
GENERATE_HEAP_SNAPSHOTS=true npm test

# Use Jest's built-in leak detection
npx jest --detectLeaks

# Analyze heap snapshots (Chrome DevTools)
# 1. Open Chrome DevTools
# 2. Go to Memory tab
# 3. Load .heapsnapshot file
# 4. Compare snapshots to find leaks
```

### Performance Impact

- **Low overhead**: ~1-5% test execution time increase
- **Memory tracking**: Minimal impact on memory usage
- **Heap snapshots**: Significant file size (disable in CI if needed)

## Integration Examples

### With React Testing Library

```javascript
import { render, cleanup } from '@testing-library/react'

afterEach(() => {
  cleanup() // Clean up DOM
  // Additional cleanup if needed
})
```

### With Enzyme

```javascript
import { mount } from 'enzyme'

describe('Component tests', () => {
  let wrapper

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount()
      wrapper = null
    }
  })
})
```

### With Node.js APIs

```javascript
describe('File operations', () => {
  const openFiles = []

  afterEach(async () => {
    // Close all open files
    await Promise.all(openFiles.map((file) => file.close()))
    openFiles.length = 0
  })
})
```

## Monitoring & Alerts

### CI Integration

```yaml
# GitHub Actions example
- name: Run tests with leak detection
  run: |
    LEAK_DETECTION_VERBOSE=true \
    GENERATE_HEAP_SNAPSHOTS=true \
    npm test

- name: Upload heap snapshots
  if: failure()
  uses: actions/upload-artifact@v3
  with:
    name: heap-snapshots
    path: heap-snapshots/
```

### Metrics Collection

The leak detector provides metrics that can be integrated with monitoring systems:

```javascript
const summary = leakDetector.getSummary()
// Send to monitoring service
console.log(JSON.stringify(summary))
```

## References

- [Jest Leak Detection](https://jestjs.io/docs/configuration#detectleaks)
- [Node.js Memory Management](https://nodejs.org/api/v8.html)
- [Chrome DevTools Memory](https://developer.chrome.com/docs/devtools/memory/)
- [JavaScript Memory Management](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Memory_Management)
