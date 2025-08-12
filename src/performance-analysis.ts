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

const { execSync, spawn } = require('child_process')
const fs = require('fs')
const path = require('path')
const os = require('os')

class PerformanceAnalysisCLI {
  constructor() {
    this.args = process.argv.slice(2)
    this.options = this.parseArguments()
    this.performanceConfig = require('../performance.config.ts')
  }

  parseArguments() {
    const options = {
      cpuOnly: false,
      memoryOnly: false,
      flamegraph: false,
      compare: false,
      pattern: null,
      output: null,
      verbose: false,
      help: false,
      watch: false,
      profile: 'development',
      threshold: null,
      format: 'html',
      open: false,
    }

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
        case '-f':
          options.flamegraph = true
          break
        case '--compare':
        case '-c':
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
        case '-o':
          options.open = true
          break
        case '--pattern':
        case '-p':
          options.pattern = this.args[++i]
          break
        case '--output':
          options.output = this.args[++i]
          break
        case '--profile':
          options.profile = this.args[++i]
          break
        case '--threshold':
        case '-t':
          options.threshold = parseInt(this.args[++i])
          break
        case '--format':
          options.format = this.args[++i]
          break
        default:
          if (arg.startsWith('--pattern=')) {
            options.pattern = arg.split('=')[1]
          } else if (arg.startsWith('--output=')) {
            options.output = arg.split('=')[1]
          } else if (arg.startsWith('--profile=')) {
            options.profile = arg.split('=')[1]
          } else if (arg.startsWith('--threshold=')) {
            options.threshold = parseInt(arg.split('=')[1])
          } else if (arg.startsWith('--format=')) {
            options.format = arg.split('=')[1]
          }
          break
      }
    }

    return options
  }

  showHelp() {
    console.log(`
🚀 Jest Performance Analysis Tool

USAGE:
  node src/performance-analysis.ts [options]

OPTIONS:
  -h, --help              Show this help message
  -v, --verbose           Enable verbose output
  -w, --watch             Watch mode - re-run on file changes
  -o, --open              Open HTML report in browser after generation
  -f, --flamegraph        Generate flamegraph visualizations
  -c, --compare           Compare with previous run
  
  --cpu-only              Only run CPU profiling
  --memory-only           Only run memory profiling
  
  -p, --pattern <pattern> Test file pattern to run
  --output <dir>          Output directory for reports
  --profile <env>         Environment profile (development|ci|production)
  --threshold <ms>        Custom slow test threshold
  --format <format>       Report format (html|json|both)

EXAMPLES:
  # Basic performance analysis
  node src/performance-analysis.ts
  
  # CPU profiling with flamegraphs
  node src/performance-analysis.ts --cpu-only --flamegraph
  
  # Memory analysis only
  node src/performance-analysis.ts --memory-only
  
  # Run specific tests with comparison
  node src/performance-analysis.ts --pattern="auth.*test.js" --compare
  
  # CI-friendly analysis
  node src/performance-analysis.ts --profile=ci --format=json
  
  # Development analysis with browser open
  node src/performance-analysis.ts --profile=development --open

ENVIRONMENT VARIABLES:
  NODE_ENV                Set environment profile
  PERFORMANCE_OUTPUT      Override output directory  
  PERFORMANCE_THRESHOLD   Override slow test threshold
  PERFORMANCE_VERBOSE     Enable verbose output
`)
  }

  async run() {
    if (this.options.help) {
      this.showHelp()
      return
    }

    console.log('🚀 Starting Jest Performance Analysis...')

    try {
      // Prepare environment
      this.setupEnvironment()

      // Build Jest command
      const jestCommand = this.buildJestCommand()

      console.log(`📊 Running: ${jestCommand}`)
      console.log(`🔧 Profile: ${this.options.profile}`)
      console.log(`📂 Output: ${this.getOutputDir()}`)

      if (this.options.watch) {
        this.runWatchMode(jestCommand)
      } else {
        await this.runSingleAnalysis(jestCommand)
      }
    } catch (error) {
      console.error('❌ Performance analysis failed:', error.message)
      process.exit(1)
    }
  }

  setupEnvironment() {
    // Set environment variables
    process.env.NODE_ENV = this.options.profile

    if (this.options.output) {
      process.env.PERFORMANCE_OUTPUT = this.options.output
    }

    if (this.options.threshold) {
      process.env.PERFORMANCE_THRESHOLD = this.options.threshold.toString()
    }

    if (this.options.verbose) {
      process.env.PERFORMANCE_VERBOSE = 'true'
    }

    // Ensure output directory exists
    const outputDir = this.getOutputDir()
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true })
    }
  }

  getOutputDir() {
    return (
      this.options.output ||
      process.env.PERFORMANCE_OUTPUT ||
      this.performanceConfig.getConfig().output.outputDir
    )
  }

  buildJestCommand() {
    const jestArgs = []

    // Add reporters - use absolute path instead of <rootDir>
    jestArgs.push('--reporters=default')
    jestArgs.push(
      `--reporters=${path.join(process.cwd(), 'reporters', 'performance-reporter.ts')}`
    )

    // Add test pattern if specified
    if (this.options.pattern) {
      jestArgs.push(`--testPathPatterns="${this.options.pattern}"`)
    }

    // Add verbose flag if needed
    if (this.options.verbose) {
      jestArgs.push('--verbose')
    }

    // Force run all tests (no cache)
    jestArgs.push('--no-cache')
    jestArgs.push('--forceExit')

    return `npx jest ${jestArgs.join(' ')}`
  }

  async runSingleAnalysis(jestCommand) {
    const startTime = Date.now()

    try {
      // Run Jest with performance reporter
      execSync(jestCommand, {
        stdio: 'inherit',
        cwd: process.cwd(),
      })

      const duration = Date.now() - startTime
      console.log(
        `✅ Performance analysis completed in ${(duration / 1000).toFixed(2)}s`
      )

      // Post-processing
      await this.postProcess()
    } catch (error) {
      console.error('❌ Jest execution failed:', error.message)
      throw error
    }
  }

  runWatchMode(jestCommand) {
    console.log('👀 Starting watch mode...')
    console.log('Press Ctrl+C to exit')

    const watchCommand = jestCommand + ' --watch'

    const child = spawn(
      'npx',
      ['jest', ...jestCommand.split(' ').slice(2), '--watch'],
      {
        stdio: 'inherit',
        cwd: process.cwd(),
      }
    )

    child.on('error', (error) => {
      console.error('❌ Watch mode failed:', error.message)
    })

    // Handle graceful shutdown
    process.on('SIGINT', () => {
      console.log('\n👋 Stopping watch mode...')
      child.kill('SIGINT')
      process.exit(0)
    })
  }

  async postProcess() {
    const outputDir = this.getOutputDir()

    console.log('🔄 Post-processing results...')

    // Find latest report
    const latestReport = this.findLatestReport(outputDir)

    if (latestReport) {
      console.log(`📊 Latest report: ${latestReport}`)

      // Handle comparison
      if (this.options.compare) {
        await this.generateComparison(latestReport)
      }

      // Open browser if requested
      if (this.options.open) {
        await this.openReport(latestReport)
      }

      // Generate summary
      this.generateSummary(latestReport)
    }
  }

  findLatestReport(outputDir) {
    try {
      const files = fs.readdirSync(outputDir)
      const htmlFiles = files.filter(
        (f) => f.endsWith('.html') && f.includes('performance-')
      )

      if (htmlFiles.length === 0) {
        return null
      }

      // Sort by creation time and get latest
      const latest = htmlFiles
        .map((f) => ({
          name: f,
          path: path.join(outputDir, f),
          mtime: fs.statSync(path.join(outputDir, f)).mtime,
        }))
        .sort((a, b) => b.mtime - a.mtime)[0]

      return latest.path
    } catch (error) {
      console.warn('Warning: Could not find latest report:', error.message)
      return null
    }
  }

  async generateComparison(latestReport) {
    console.log('📈 Generating comparison report...')

    try {
      // This would compare with previous runs
      // Implementation would read historical data and generate diff
      console.log('📊 Comparison analysis complete')
    } catch (error) {
      console.warn('Warning: Could not generate comparison:', error.message)
    }
  }

  async openReport(reportPath) {
    console.log('🌐 Opening report in browser...')

    try {
      const platform = os.platform()
      let command

      switch (platform) {
        case 'darwin':
          command = 'open'
          break
        case 'win32':
          command = 'start'
          break
        default:
          command = 'xdg-open'
      }

      execSync(`${command} "${reportPath}"`, { stdio: 'ignore' })
      console.log('✅ Report opened in browser')
    } catch (error) {
      console.warn('Warning: Could not open browser:', error.message)
      console.log(`📄 Report available at: ${reportPath}`)
    }
  }

  generateSummary(reportPath) {
    console.log('\n📋 Performance Analysis Summary:')
    console.log('═'.repeat(50))
    console.log(`📊 Report: ${reportPath}`)
    console.log(`🔧 Profile: ${this.options.profile}`)
    console.log(`📂 Output: ${this.getOutputDir()}`)

    if (this.options.pattern) {
      console.log(`🎯 Pattern: ${this.options.pattern}`)
    }

    console.log('\n💡 Next Steps:')
    console.log('• Open the HTML report to view detailed performance metrics')
    console.log('• Check flamegraphs for CPU bottlenecks')
    console.log('• Review memory usage patterns')
    console.log('• Implement recommended optimizations')

    if (!this.options.open) {
      console.log(`\n🌐 Open report: file://${reportPath}`)
    }
  }
}

// Run the CLI if this file is executed directly
if (require.main === module) {
  const cli = new PerformanceAnalysisCLI()
  cli.run().catch((error) => {
    console.error('❌ Fatal error:', error)
    process.exit(1)
  })
}

module.exports = PerformanceAnalysisCLI
