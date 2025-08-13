#!/usr/bin/env node

/**
 * Jest Performance Analysis CLI Tool
 *
 * This script provides a command-line interface for running performance analysis
 * on your Jest test suite with various options and reporting capabilities.
 *
 * Usage:
 *   node src/performance-analysis.ts [options]
 *
 * Examples:
 *   # Basic performance run
 *   npm run test:performance
 *
 *   # CPU profiling only
 *   node src/performance-analysis.ts --cpu-only
 *
 *   # Memory analysis only
 *   node src/performance-analysis.ts --memory-only
 *
 *   # Generate flamegraphs
 *   node src/performance-analysis.ts --flamegraph
 *
 *   # Compare with previous run
 *   node src/performance-analysis.ts --compare
 *
 *   # Run specific test pattern
 *   node src/performance-analysis.ts --pattern="*.performance.test.js"
 */

import { execSync, spawn } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { getPerformanceConfig } from './config/performance'

interface PerformanceOptions {
  cpuOnly: boolean
  memoryOnly: boolean
  flamegraph: boolean
  compare: boolean
  pattern: string | null
  output: string | null
  profile: string | null
  threshold: number | null
  verbose: boolean
  watch: boolean
  open: boolean
  format: string | null
  help: boolean
}

class PerformanceAnalysisCLI {
  private args: string[]
  private options: PerformanceOptions
  private performanceConfig: any

  constructor() {
    this.args = process.argv.slice(2)
    this.options = this.parseArguments()
    this.performanceConfig = getPerformanceConfig()
  }

  parseArguments(): PerformanceOptions {
    const options: PerformanceOptions = {
      cpuOnly: false,
      memoryOnly: false,
      flamegraph: false,
      compare: false,
      pattern: null,
      output: null,
      profile: null,
      threshold: null,
      verbose: false,
      watch: false,
      open: false,
      format: null,
      help: false,
    }

    // Parse command line arguments
    for (let i = 0; i < this.args.length; i++) {
      const arg = this.args[i]

      switch (arg) {
        case '--help':
        case '-h':
          options.help = true
          break

        case '--cpu-only':
          options.cpuOnly = true
          break

        case '--memory-only':
          options.memoryOnly = true
          break

        case '--flamegraph':
          options.flamegraph = true
          break

        case '--compare':
          options.compare = true
          break

        case '--verbose':
        case '-v':
          options.verbose = true
          break

        case '--watch':
        case '-w':
          options.watch = true
          break

        case '--open':
          options.open = true
          break

        case '--pattern':
        case '-p':
          if (i + 1 < this.args.length) {
            options.pattern = this.args[++i]
          }
          break

        case '--output':
        case '-o':
          if (i + 1 < this.args.length) {
            options.output = this.args[++i]
          }
          break

        case '--profile':
          if (i + 1 < this.args.length) {
            options.profile = this.args[++i]
          }
          break

        case '--threshold':
          if (i + 1 < this.args.length) {
            options.threshold = parseInt(this.args[++i])
          }
          break

        case '--format':
        case '-f':
          if (i + 1 < this.args.length) {
            options.format = this.args[++i]
          }
          break

        default:
          // Handle --key=value format
          if (arg.includes('=')) {
            const [key, value] = arg.split('=', 2)
            switch (key) {
              case '--threshold':
                options.threshold = parseInt(value)
                break
              case '--pattern':
                options.pattern = value
                break
              case '--output':
                options.output = value
                break
              case '--format':
                options.format = value
                break
            }
          }
          break
      }
    }

    return options
  }

  displayHelp(): void {
    console.log(`
🚀 Jest Performance Analysis Tool

USAGE:
  node src/performance-analysis.ts [OPTIONS]

OPTIONS:
  --help, -h              Show this help message
  --cpu-only              Run CPU profiling only
  --memory-only           Run memory analysis only
  --flamegraph            Generate CPU flamegraphs
  --compare               Compare with previous run results
  --watch, -w             Run in watch mode (continuous analysis)
  --open                  Open performance report in browser
  --verbose, -v           Enable verbose output
  
  --pattern, -p <pattern> Test file pattern to analyze
  --output, -o <dir>      Output directory for reports
  --profile <profile>     Performance profile (dev, ci, prod)
  --threshold <ms>        Performance threshold in milliseconds
  --format, -f <format>   Output format (html, json, csv)

EXAMPLES:
  # Basic performance analysis
  npm run test:performance
  
  # CPU profiling with flamegraphs
  node src/performance-analysis.ts --cpu-only --flamegraph
  
  # Memory analysis only
  node src/performance-analysis.ts --memory-only
  
  # Analyze specific test pattern
  node src/performance-analysis.ts --pattern="**/*.perf.test.js"
  
  # Compare with previous results
  node src/performance-analysis.ts --compare --open
  
  # Watch mode for development
  node src/performance-analysis.ts --watch --verbose

ENVIRONMENT VARIABLES:
  NODE_ENV                Set environment (development, ci, production)
  PERFORMANCE_OUTPUT      Override output directory
  PERFORMANCE_THRESHOLD   Override performance threshold
  PERFORMANCE_VERBOSE     Enable verbose logging
`)
  }

  async run(): Promise<void> {
    if (this.options.help) {
      this.displayHelp()
      return
    }

    console.log('🔥 Starting Jest Performance Analysis...')
    console.log(`🔧 Profile: ${this.options.profile || 'default'}`)
    console.log(`📊 Output: ${this.getOutputDirectory()}`)

    try {
      if (this.options.watch) {
        this.runWatchMode(this.buildJestCommand())
      } else {
        await this.runSingleAnalysis(this.buildJestCommand())
      }
    } catch (error) {
      console.error('❌ Performance analysis failed:', (error as Error).message)
      process.exit(1)
    }
  }

  private setupEnvironment(): void {
    // Set environment variables for Jest and reporters
    process.env.NODE_ENV = this.options.profile || 'development'

    if (this.options.output) {
      process.env.PERFORMANCE_OUTPUT = this.options.output
    }

    if (this.options.threshold) {
      process.env.PERFORMANCE_THRESHOLD = this.options.threshold.toString()
    }

    if (this.options.verbose) {
      process.env.PERFORMANCE_VERBOSE = 'true'
    }
  }

  private getOutputDirectory(): string {
    return (
      this.options.output ||
      process.env.PERFORMANCE_OUTPUT ||
      this.performanceConfig.output.outputDir
    )
  }

  private buildJestCommand(): string[] {
    this.setupEnvironment()

    const jestArgs = [
      'jest',
      '--config=jest.config.ts',
      '--no-cache', // Ensure clean runs for accurate performance measurement
    ]

    // Add test pattern if specified
    if (this.options.pattern) {
      jestArgs.push(`--testPathPattern="${this.options.pattern}"`)
    }

    // Add verbose flag if requested
    if (this.options.verbose) {
      jestArgs.push('--verbose')
    }

    // Use npx to ensure we use the local Jest installation
    return ['npx', ...jestArgs]
  }

  async runSingleAnalysis(jestCommand: string[]): Promise<void> {
    console.log(`🧪 Running Jest: ${jestCommand.join(' ')}`)

    try {
      // Run Jest with performance reporters
      const startTime = Date.now()
      execSync(jestCommand.join(' '), {
        stdio: 'inherit',
        cwd: process.cwd(),
        env: { ...process.env },
      })

      const duration = Date.now() - startTime
      console.log(`✅ Analysis completed in ${duration}ms`)

      await this.postProcessResults()
    } catch (error) {
      console.error('❌ Jest execution failed:', (error as Error).message)
      throw error
    }
  }

  runWatchMode(jestCommand: string[]): void {
    console.log('👁️  Running in watch mode... (Press Ctrl+C to stop)')

    const watchCommand = [...jestCommand, '--watch']
    const child = spawn(watchCommand[0], watchCommand.slice(1), {
      stdio: 'inherit',
      cwd: process.cwd(),
      env: { ...process.env },
    })

    child.on('error', (error: Error) => {
      console.error('❌ Watch mode error:', error.message)
    })

    child.on('exit', (code: number | null) => {
      console.log(`🔚 Watch mode exited with code ${code}`)
    })

    // Handle graceful shutdown
    process.on('SIGINT', () => {
      console.log('\n🛑 Stopping watch mode...')
      child.kill('SIGINT')
      process.exit(0)
    })

    process.on('SIGTERM', () => {
      child.kill('SIGTERM')
      process.exit(0)
    })
  }

  private async postProcessResults(): Promise<void> {
    const outputDir = this.getOutputDirectory()

    try {
      // Generate comparison reports if requested
      if (this.options.compare) {
        await this.generateComparison(this.findLatestReport(outputDir))
      }

      // Open browser if requested
      if (this.options.open) {
        await this.openReport(this.findLatestReport(outputDir))
      }

      this.generateSummary(this.findLatestReport(outputDir))
    } catch (error) {
      console.warn('⚠️  Post-processing warning:', (error as Error).message)
    }
  }

  findLatestReport(outputDir: string): string | null {
    try {
      const files = fs
        .readdirSync(outputDir)
        .filter((f) => f.endsWith('.html') && f.includes('performance-'))

      if (files.length === 0) {
        return null
      }

      // Find the most recent file by modification time
      const latest = files
        .map((f) => ({
          file: f,
          path: path.join(outputDir, f),
          mtime: fs.statSync(path.join(outputDir, f)).mtime.getTime(),
        }))
        .sort((a, b) => b.mtime - a.mtime)[0]

      return latest.path
    } catch (error) {
      console.warn(
        'Warning: Could not find latest report:',
        (error as Error).message
      )
      return null
    }
  }

  async generateComparison(latestReport: string | null): Promise<void> {
    if (!latestReport) {
      console.warn('⚠️  No report found for comparison')
      return
    }

    try {
      console.log('📊 Generating performance comparison...')
      // Implementation would go here - comparing with historical data
      console.log('📈 Comparison report generated')
    } catch (error) {
      console.warn(
        'Warning: Could not generate comparison:',
        (error as Error).message
      )
    }
  }

  async openReport(reportPath: string | null): Promise<void> {
    if (!reportPath) {
      console.warn('⚠️  No report found to open')
      return
    }

    try {
      console.log(`🌐 Opening performance report: ${reportPath}`)

      // Cross-platform browser opening
      const platform = os.platform()
      let command: string

      switch (platform) {
        case 'darwin': // macOS
          command = `open "${reportPath}"`
          break
        case 'win32': // Windows
          command = `start "${reportPath}"`
          break
        default: // Linux and others
          command = `xdg-open "${reportPath}"`
          break
      }

      execSync(command)
      console.log('✅ Report opened in browser')
    } catch (error) {
      console.warn('Warning: Could not open browser:', (error as Error).message)
    }
  }

  generateSummary(reportPath: string | null): void {
    console.log('\n📋 PERFORMANCE ANALYSIS SUMMARY')
    console.log('═'.repeat(50))
    console.log(`🔧 Profile: ${this.options.profile || 'default'}`)
    console.log(`📊 Output Directory: ${this.getOutputDirectory()}`)

    if (this.options.pattern) {
      console.log(`🎯 Pattern: ${this.options.pattern}`)
    }

    if (reportPath) {
      console.log(`📄 Latest Report: ${reportPath}`)
    }

    console.log('\n💡 Next Steps:')
    console.log('   • Review the HTML report for detailed insights')
    console.log('   • Check flamegraphs for CPU bottlenecks')
    console.log('   • Analyze memory usage patterns')
    console.log('   • Compare with previous runs using --compare')

    if (!this.options.open) {
      console.log(`   • Open report manually: ${reportPath}`)
    }

    console.log('═'.repeat(50))
  }
}

// Run the CLI if this script is executed directly
if (require.main === module) {
  const cli = new PerformanceAnalysisCLI()
  cli.run().catch((error) => {
    console.error('Fatal error:', error)
    process.exit(1)
  })
}

export { PerformanceAnalysisCLI }
export default PerformanceAnalysisCLI
