#!/usr/bin/env node

/**
 * Test Runner Script
 * Provides utilities for running tests in different configurations
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

class TestRunner {
    constructor() {
        this.testTypes = {
            unit: 'unit',
            integration: 'integration',
            all: 'all'
        };
    }

    /**
     * Check if required dependencies are installed
     */
    checkDependencies() {
        const requiredPackages = ['jest', 'supertest'];
        const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));

        const missing = requiredPackages.filter(pkg =>
            !packageJson.devDependencies[pkg] && !packageJson.dependencies[pkg]
        );

        if (missing.length > 0) {
            console.error('❌ Missing required test dependencies:', missing.join(', '));
            console.log('Run: npm install --save-dev', missing.join(' '));
            process.exit(1);
        }
    }

    /**
     * Setup test environment
     */
    setupEnvironment() {
        // Ensure test environment file exists
        const testEnvPath = '.env.test';
        if (!fs.existsSync(testEnvPath)) {
            console.log('📝 Creating test environment file...');
            const envTemplate = `# Test Environment - Auto-generated
NODE_ENV=test
JWT_SECRET=test-jwt-secret-key-for-testing-only
DB_NAME=treblle_api_test
PORT=0
TREBLLE_API_KEY=disabled-in-tests
TREBLLE_PROJECT_ID=disabled-in-tests
`;
            fs.writeFileSync(testEnvPath, envTemplate);
        }

        // Create test directories if they don't exist
        const testDirs = [
            '__tests__/unit',
            '__tests__/integration',
            '__tests__/fixtures'
        ];

        testDirs.forEach(dir => {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
                console.log(`📁 Created directory: ${dir}`);
            }
        });
    }

    /**
     * Run specific test suite
     */
    runTests(testType = 'all', options = {}) {
        this.checkDependencies();
        this.setupEnvironment();

        /**
         * Run specific test suite
         */
        runTests(testType = 'all', options = {}) {
            this.checkDependencies();
            this.setupEnvironment();

            console.log(`🧪 Running ${testType} tests...`);

            let jestCommand = 'npx jest';

            // Add test pattern based on type
            switch (testType) {
                case 'unit':
                    jestCommand += ' --testPathPattern=unit';
                    break;
                case 'integration':
                    jestCommand += ' --testPathPattern=integration';
                    break;
                case 'all':
                    // Run all tests
                    break;
                default:
                    console.error('❌ Invalid test type. Use: unit, integration, or all');
                    process.exit(1);
            }

            // Add common Jest options
            jestCommand += ' --detectOpenHandles --forceExit';

            // Add coverage if requested
            if (options.coverage) {
                jestCommand += ' --coverage';
            }

            // Add watch mode if requested
            if (options.watch) {
                jestCommand += ' --watch';
            }

            // Add verbose output if requested
            if (options.verbose) {
                jestCommand += ' --verbose';
            }

            try {
                console.log(`Running: ${jestCommand}`);
                execSync(jestCommand, {
                    stdio: 'inherit',
                    env: { ...process.env, NODE_ENV: 'test' }
                });
                console.log('✅ Tests completed successfully');
            } catch (error) {
                console.error('❌ Tests failed');
                process.exit(1);
            }
        }

        /**
         * Generate test coverage report
         */
        generateCoverage() {
            console.log('📊 Generating test coverage report...');
            try {
                execSync('npx jest --coverage --detectOpenHandles --forceExit', {
                    stdio: 'inherit',
                    env: { ...process.env, NODE_ENV: 'test' }
                });
                console.log('✅ Coverage report generated in ./coverage directory');
            } catch (error) {
                console.error('❌ Coverage generation failed');
                process.exit(1);
            }
        }

        /**
         * Watch tests for changes
         */
        watchTests(testType = 'all') {
            console.log(`👀 Watching ${testType} tests for changes...`);
            this.runTests(testType, { watch: true });
        }

  /**
   * Run tests with database setup
   */
  async runIntegrationTests() {
            console.log('🗄️ Setting up test database...');

            // Check if database connection is possible
            try {
                const database = require('../../config/database');
                await database.connect();
                console.log('✅ Test database connection successful');
                await database.close();
            } catch (error) {
                console.warn('⚠️ Database not available, running with mocked data');
                process.env.SKIP_DB_TESTS = 'true';
            }

            this.runTests('integration');
        }

        /**
         * Clean up test artifacts
         */
        cleanup() {
            console.log('🧹 Cleaning up test artifacts...');

            const cleanupPaths = [
                'coverage',
                '__tests__/temp',
                '.nyc_output'
            ];

            cleanupPaths.forEach(cleanupPath => {
                if (fs.existsSync(cleanupPath)) {
                    fs.rmSync(cleanupPath, { recursive: true, force: true });
                    console.log(`🗑️ Removed: ${cleanupPath}`);
                }
            });

            console.log('✅ Cleanup completed');
        }

        /**
         * Display help information
         */
        showHelp() {
            console.log(`
🧪 Test Runner Help

Usage: node __tests__/scripts/testRunner.js [command] [options]

Commands:
  unit                 Run unit tests only
  integration          Run integration tests only
  all                  Run all tests (default)
  coverage             Generate coverage report
  watch [type]         Watch tests for changes
  cleanup              Clean up test artifacts
  help                 Show this help message

Options:
  --verbose            Show detailed test output
  --coverage           Include coverage report
  --watch              Watch for file changes

Examples:
  node __tests__/scripts/testRunner.js unit
  node __tests__/scripts/testRunner.js integration --verbose
  node __tests__/scripts/testRunner.js all --coverage
  node __tests__/scripts/testRunner.js watch unit
    `);
        }
    }

    // CLI execution
    if(require.main === module) {
    const runner = new TestRunner();
    const args = process.argv.slice(2);
    const command = args[0] || 'all';
    const options = {
        verbose: args.includes('--verbose'),
        coverage: args.includes('--coverage'),
        watch: args.includes('--watch')
    };

    switch (command) {
        case 'unit':
            runner.runTests('unit', options);
            break;
        case 'integration':
            runner.runIntegrationTests();
            break;
        case 'all':
            runner.runTests('all', options);
            break;
        case 'coverage':
            runner.generateCoverage();
            break;
        case 'watch':
            const watchType = args[1] || 'all';
            runner.watchTests(watchType);
            break;
        case 'cleanup':
            runner.cleanup();
            break;
        case 'help':
        case '--help':
        case '-h':
            runner.showHelp();
            break;
        default:
            console.error(`❌ Unknown command: ${command}`);
            runner.showHelp();
            process.exit(1);
    }
}

module.exports = TestRunner;