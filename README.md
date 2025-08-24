# Jest Utils

A collection of Jest utilities for advanced test reporting, flaky test detection, and memory leak detection.

Uses `@swc/jest` for fast TypeScript transpilation of tests and `tsx` for full TypeScript support test configuration, reporters and utilities.

## Features

### 🔍 Custom Jest Reporter

- Detailed test lifecycle logging
- Multi-project environment support
- Comprehensive test run analysis

### 📊 Flaky Test Detection

- Persistent test history tracking
- Statistical analysis of test stability
- Actionable recommendations for fixing flaky tests

### 💧 Memory Leak Detection

- Monitors memory usage, global variables, timers, and event listeners
- Configurable thresholds and analysis
- Heap snapshot generation for debugging

### 🖨️ Collector & Exporter

- Collects data during reporter events, exports a report in JSON or CSV formats
- Can easily be extended for custom data collection
- Standalone utility to easily output file reports from any reporter

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

```sh
jest-utils/
├── lib/                # Reusable Jest utilities
├── lib/reporters/      # Custom Jest reporters
├── docs/               # Documentation
├── mixed/              # Test files for demo/testing
├── jest.config.ts      # Jest configuration
└── jest.config.memory.ts  # Leak detection settings
```

## Configuration

The project supports multiple configuration options:

- **Jest Config**: Multi-project setup with client/server environments
- **Reporter Options**: Configurable logging, flaky detection, and leak detection
- **Environment Variables**: Runtime configuration for different environments

## Utilities

### Custom Flake Reporter (`lib/reporters/memory-reporter.ts`)

- Comprehensive test lifecycle logging
- Flaky test detection and reporting
- Memory leak detection integration

### Leak Detector (`lib/tools/memory/leak-detector.ts`)

- Standalone memory leak detection utility
- Configurable thresholds and analysis
- Multiple integration options

### Setup Files

- `jest.setup.memory.ts` - Automatic leak detection setup

## Development

This project uses:

- **Package Manager**: pnpm (locked to version 10.12.4)
- **Test Environment**: Jest with multi-project configuration
- **Node.js**: Compatible with modern Node.js versions
