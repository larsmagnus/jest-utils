# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a comprehensive Jest utilities project providing advanced test reporting, flaky test detection, and memory leak detection capabilities. The project uses pnpm as the package manager.

## Commands

- **Package Manager**: `pnpm` (specified in package.json)
- **Install Dependencies**: `pnpm install`
- **Run Tests**: `pnpm test` (runs all tests with custom reporter)
- **Test Client Only**: `pnpm test:client`
- **Test Server Only**: `pnpm test:server`

## Architecture

### Project Structure

- `client/` - Client-side code with jsdom test environment
- `server/` - Server-side code with Node.js test environment
- `reporters/` - Custom Jest reporters
- `utils/` - Reusable utilities (leak detection, etc.)
- `docs/` - Documentation for utilities and features
- `jest.config.js` - Jest configuration with multi-project setup
- `leak-detection.config.js` - Configuration for memory leak detection

### Custom Reporter

- Location: `reporters/custom-reporter.js`
- Logs detailed information throughout the Jest test lifecycle
- Outputs to both console and `test-report.log` file
- Tracks test execution phases, timing, and results
- Provides comprehensive test run summaries
- **Flaky Test Detection**: Automatically tracks test history and identifies potentially unstable tests
  - Maintains persistent test execution history in `flaky-test-history.json`
  - Analyzes test patterns across multiple runs to detect inconsistent results
  - Reports flaky tests with failure rates, statistics, and remediation recommendations
  - Configurable thresholds and history limits via reporter options
- **Memory Leak Detection**: Comprehensive leak detection for test resource cleanup
  - Monitors memory usage, global variables, timers, and event listeners
  - Identifies tests that don't properly clean up resources
  - Provides detailed leak analysis with actionable recommendations
  - Supports heap snapshot generation for advanced debugging
  - Configurable via `leak-detection.config.js` with environment-specific settings

### Test Environment

- Multi-project Jest setup with separate client and server configurations
- Client tests use jsdom environment for DOM-based testing
- Server tests use Node.js environment
- Tests in `mixed/` folder with pattern-based routing:
  - `*.client.test.js` - Run only in client project (jsdom)
  - `*.server.test.js` - Run only in server project (node)
  - `*.test.js` - Run in both client and server projects
- Custom reporter runs alongside default Jest reporter

## Development Notes

- Package manager is locked to pnpm@10.12.4
- Custom reporter provides detailed logging of test lifecycle events
- Log file `test-report.log` is generated with each test run
- Flaky test history is persisted in `flaky-test-history.json`
- Memory leak detection logs to `leak-detection.log`
- Verbose mode only activates with `--verbose` flag: `pnpm test -- --verbose`
- Reporter automatically detects and reports flaky tests with actionable recommendations
- Memory leak detection is integrated into the custom reporter and can be configured per environment

## Utilities

### Memory Leak Detection

- **Location**: `utils/leak-detector.js`
- **Setup File**: `jest-setup-leak-detection.js` for automatic integration
- **Config**: `leak-detection.config.js` with environment-specific settings
- **Documentation**: `docs/LEAK_DETECTION.md` for detailed usage guide
- **Features**: Tracks memory usage, global variables, timers, event listeners, and promises
- **Integration**: Available as reporter integration, setup file, or manual usage
- **Environment Variables**: Configurable via `LEAK_DETECTION_VERBOSE`, `GENERATE_HEAP_SNAPSHOTS`, etc.
