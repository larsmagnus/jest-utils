# Jest Performance Analysis

A comprehensive Jest performance reporter that provides detailed performance analysis, flamegraphs, and bottleneck detection for your test suite.

## Features

🚀 **Comprehensive Performance Metrics**

- High-resolution timing for tests and suites
- Memory usage tracking and leak detection
- CPU profiling with V8 integration
- Performance regression detection

🔥 **Flamegraph Generation**

- Interactive CPU flamegraphs
- Function-level performance analysis
- Visual bottleneck identification
- D3.js-powered visualizations

📊 **Interactive Reports**

- Rich HTML dashboards with charts
- Test duration distribution analysis
- Memory usage patterns
- Performance recommendations

📈 **Trending and History**

- Historical performance tracking
- Regression detection
- Trend analysis across runs
- Baseline comparisons

## Quick Start

### Basic Performance Analysis

```bash
# Run basic performance analysis
pnpm test:performance

# Run with flamegraph generation
pnpm test:performance:cpu

# Run memory analysis only
pnpm test:performance:memory

# Open results in browser
pnpm test:performance:open
```

### Command Line Interface

```bash
# Full CLI options
node src/performance-analysis.ts --help

# CPU profiling with flamegraphs
node src/performance-analysis.ts --cpu-only --flamegraph

# Watch mode for development
node src/performance-analysis.ts --watch

# Compare with previous runs
node src/performance-analysis.ts --compare

# Specific test pattern
node src/performance-analysis.ts --pattern="auth.*test.js"
```

## Configuration

### Performance Configuration File

The performance reporter is configured via `jest.config.performance.ts`:

```javascript
export default {
  output: {
    outputDir: 'reports/performance-reports',
    htmlReport: true,
    jsonReport: true,
    flamegraphReport: true,
  },

  profiling: {
    enableCPUProfiling: true,
    enableMemoryProfiling: true,
    sampleInterval: 1000, // microseconds
  },

  thresholds: {
    slowTestThreshold: 1000, // ms
    memoryThreshold: 50, // MB
  },

  trending: {
    enabled: true,
    maxHistoryRuns: 100,
  },

  flamegraph: {
    width: 1200,
    height: 600,
  },
}
```

### Environment Profiles

Different environments have optimized configurations:

**Development Profile:**

- Detailed profiling with lower sample intervals
- Larger flamegraph dimensions
- All features enabled

**CI Profile:**

- Lighter profiling to avoid timeouts
- Stricter performance thresholds
- Focus on memory analysis

**Production Profile:**

- Minimal profiling overhead
- Essential metrics only
- No flamegraph generation

## Understanding the Reports

### HTML Dashboard

The interactive HTML report includes:

1. **Overview Tab**: Key metrics and summary charts
2. **Test Details Tab**: Individual test performance
3. **Test Suites Tab**: Suite-level analysis
4. **Recommendations Tab**: Automated performance suggestions
5. **Trends Tab**: Historical performance data (when enabled)

### Performance Metrics

**Test Metrics:**

- `duration`: Test execution time in milliseconds
- `memoryDelta`: Memory usage change during test
- `isSlowTest`: Exceeds slow test threshold
- `hasMemoryIssue`: High memory usage detected

**Suite Metrics:**

- `duration`: Total suite execution time
- `tests`: Array of test performance data
- `memorySnapshots`: Memory state at key points

### Flamegraphs

CPU flamegraphs show:

- Function call hierarchy
- Time spent in each function
- Performance bottlenecks
- Call stack visualization

**Reading Flamegraphs:**

- Width = time spent in function
- Height = call stack depth
- Color = different functions
- Click to zoom into specific areas

## Performance Thresholds

### Default Thresholds

- **Slow Test**: > 1000ms execution time
- **Memory Issue**: > 50MB memory usage increase
- **Slow Suite**: > 5000ms total execution time

### Custom Thresholds

```bash
# Set custom slow test threshold
node src/performance-analysis.ts --threshold=500

# Via environment variable
PERFORMANCE_THRESHOLD=500 pnpm test:performance
```

## Advanced Usage

### CPU Profiling Only

When you only need CPU analysis:

```bash
# Generate detailed CPU profiles and flamegraphs
pnpm test:performance:cpu

# Or with custom options
node src/performance-analysis.ts --cpu-only --flamegraph --verbose
```

### Memory Analysis

Focus on memory usage patterns:

```bash
# Memory profiling with heap snapshots
pnpm test:performance:memory

# High memory threshold for detailed analysis
node src/performance-analysis.ts --memory-only --threshold=25
```

### Watch Mode Development

Continuous analysis during development:

```bash
# Re-run analysis on file changes
pnpm test:performance:watch

# Watch specific test pattern
node src/performance-analysis.ts --watch --pattern="auth.*"
```

### Comparison Analysis

Compare performance across runs:

```bash
# Compare with previous run
pnpm test:performance:compare

# Generate regression report
node src/performance-analysis.ts --compare --format=json
```

## Interpreting Results

### Performance Recommendations

The reporter automatically generates recommendations:

**High Priority Issues:**

- Tests exceeding slow thresholds
- Memory leaks and high usage
- Performance regressions

**Optimization Suggestions:**

- Break down large tests
- Optimize slow functions
- Improve cleanup procedures
- Mock expensive operations

### Common Performance Issues

**Slow Tests:**

- Database operations without mocking
- Complex calculations
- File system operations
- Network requests

**Memory Issues:**

- Uncleared timers and intervals
- Event listeners not removed
- Large data structures
- Circular references

**Suite-Level Issues:**

- Too many tests in single file
- Heavy setup/teardown operations
- Shared state between tests

## Integration with CI/CD

### GitHub Actions Example

```yaml
name: Performance Analysis
on: [push, pull_request]

jobs:
  performance:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install
      - run: npm run test:performance
        env:
          NODE_ENV: ci
      - uses: actions/upload-artifact@v3
        with:
          name: performance-reports
          path: performance-reports/
```

### Performance Budgets

Set performance budgets in CI:

```bash
# Fail if average test time exceeds budget
node src/performance-analysis.ts --threshold=200 --profile=ci

# Check for regressions
node src/performance-analysis.ts --compare --profile=ci
```

## Troubleshooting

### Common Issues

**V8 Profiling Errors:**

- Ensure Node.js version supports V8 profiling
- Check for sufficient memory and permissions
- Reduce sample interval if needed

**Memory Snapshot Failures:**

- Increase Node.js heap size: `node --max-old-space-size=4096`
- Ensure write permissions to output directory

**Report Generation Issues:**

- Verify Chart.js and D3.js CDN availability
- Check HTML report template syntax
- Ensure output directory is writable

### Debug Mode

Enable verbose logging:

```bash
# Verbose output
node src/performance-analysis.ts --verbose

# Environment variable
PERFORMANCE_VERBOSE=true pnpm test:performance
```

## File Structure

```sh
performance-reports/
├── performance-run-123.json          # Raw performance data
├── html-reports/
│   ├── performance-run-123.html      # Interactive dashboard
│   └── latest-report.html            # Latest report link
├── cpu-profiles/
│   ├── global-test-run.cpuprofile    # V8 CPU profiles
│   └── suite-math-test.cpuprofile
├── memory-snapshots/
│   ├── initial.heapsnapshot          # Heap snapshots
│   └── final.heapsnapshot
├── flamegraphs/
│   ├── global-test-run.json          # Flamegraph data
│   ├── global-test-run.html          # Interactive flamegraph
│   └── suite-math-test.html
└── performance-history.json          # Historical data
```

## API Reference

### Performance Reporter Class

```javascript
const PerformanceReporter = require('./src/reporters/performance-reporter')

const reporter = new PerformanceReporter(globalConfig, {
  output: {
    outputDir: 'reports/custom-reports',
    htmlReport: true,
  },
  profiling: {
    enableCPUProfiling: true,
  },
  thresholds: {
    slowTestThreshold: 500,
  },
})
```

### Configuration Schema

```typescript
interface PerformanceConfig {
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
  }
  thresholds: {
    slowTestThreshold: number
    memoryThreshold: number
  }
  trending: {
    enabled: boolean
    maxHistoryRuns: number
  }
  flamegraph: {
    width: number
    height: number
  }
}
```

## Best Practices

### Performance Testing Strategy

1. **Baseline Establishment**: Run initial analysis to establish performance baseline
2. **Regular Monitoring**: Include performance tests in CI pipeline
3. **Threshold Tuning**: Adjust thresholds based on project requirements
4. **Regression Prevention**: Use comparison mode to catch regressions early

### Test Organization

1. **Separate Performance Tests**: Create dedicated `*.performance.test.js` files
2. **Mock External Dependencies**: Avoid network and file system operations
3. **Cleanup Resources**: Properly dispose of timers, listeners, and connections
4. **Isolate Tests**: Avoid shared state between tests

### Flamegraph Analysis

1. **Focus on Wide Bars**: Wide sections indicate high time consumption
2. **Look for Unexpected Functions**: Functions that shouldn't be in critical path
3. **Check Call Frequency**: Functions called many times might need optimization
4. **Analyze Deep Stacks**: Deep call stacks might indicate inefficient algorithms

## Contributing

To contribute to the performance reporter:

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Ensure existing tests pass
5. Submit a pull request

For bug reports and feature requests, please use the GitHub issue tracker.

## License

This project is licensed under the MIT License - see the LICENSE file for details.
