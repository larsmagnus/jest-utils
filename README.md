# Jest Utils

A comprehensive collection of Jest utilities for advanced test reporting, flaky test detection, and memory leak detection.

## Features

🔍 **Custom Jest Reporter**

- Detailed test lifecycle logging
- Multi-project environment support
- Comprehensive test run analysis

📊 **Flaky Test Detection**

- Persistent test history tracking
- Statistical analysis of test stability
- Actionable recommendations for fixing flaky tests

💧 **Memory Leak Detection**

- Monitors memory usage, global variables, timers, and event listeners
- Configurable thresholds and analysis
- Heap snapshot generation for debugging

## Quick Start

```bash
# Install dependencies
pnpm install

# Run all tests
pnpm test

# Run tests with verbose output
pnpm test -- --verbose

# Run specific project tests
pnpm test:client
pnpm test:server
```

## Documentation

- [`CLAUDE.md`](./CLAUDE.md) - Developer guide and architecture overview
- [`docs/LEAK_DETECTION.md`](./docs/LEAK_DETECTION.md) - Memory leak detection guide

## Project Structure

```
jest-utils/
├── reporters/           # Custom Jest reporters
├── utils/              # Reusable utilities
├── docs/               # Documentation
├── mixed/              # Test files for demo/testing
├── jest.config.js      # Jest configuration
└── leak-detection.config.js  # Leak detection settings
```

## Configuration

The project supports multiple configuration options:

- **Jest Config**: Multi-project setup with client/server environments
- **Reporter Options**: Configurable logging, flaky detection, and leak detection
- **Environment Variables**: Runtime configuration for different environments

## Utilities

### Custom Reporter (`reporters/custom-reporter.js`)

- Comprehensive test lifecycle logging
- Flaky test detection and reporting
- Memory leak detection integration

### Leak Detector (`utils/leak-detector.js`)

- Standalone memory leak detection utility
- Configurable thresholds and analysis
- Multiple integration options

### Setup Files

- `jest-setup-leak-detection.js` - Automatic leak detection setup

## Development

This project uses:

- **Package Manager**: pnpm (locked to version 10.12.4)
- **Test Environment**: Jest with multi-project configuration
- **Node.js**: Compatible with modern Node.js versions

## License

ISC
