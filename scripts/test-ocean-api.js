#!/usr/bin/env node

/**
 * Ocean API Integration Test Suite
 * Tests all Ocean.xyz API endpoints to ensure they're working correctly
 *
 * Usage: node scripts/test-ocean-api.js
 */

import https from 'https';
import util from 'util';

// Test configuration
const TEST_ADDRESS = 'bc1q6f3ged3f74sga3z2cgeyehv5f9lu9r6p5arqvf44yzsy4gtjxtlsmnhn8j';
const OCEAN_BASE_URL = 'https://ocean.xyz';

// Colors for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

class OceanAPITester {
  constructor() {
    this.results = {
      passed: 0,
      failed: 0,
      tests: []
    };
  }

  log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
  }

  async httpGet(url) {
    return new Promise((resolve, reject) => {
      const request = https.get(url, (response) => {
        let data = '';

        response.on('data', (chunk) => {
          data += chunk;
        });

        response.on('end', () => {
          if (response.statusCode !== 200) {
            reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
            return;
          }

          try {
            // Try to parse as JSON first
            const jsonData = JSON.parse(data);
            resolve({ data: jsonData, raw: data, contentType: 'json' });
          } catch (e) {
            // If JSON parse fails, return as text
            resolve({ data: data, raw: data, contentType: 'text' });
          }
        });
      });

      request.on('error', (error) => {
        reject(error);
      });

      request.setTimeout(10000, () => {
        request.destroy();
        reject(new Error('Request timeout'));
      });
    });
  }

  async runTest(name, testFn, ...args) {
    process.stdout.write(`${colors.blue}Testing ${name}...${colors.reset} `);

    const startTime = Date.now();

    try {
      const result = await testFn.call(this, ...args);
      const duration = Date.now() - startTime;

      this.results.passed++;
      this.results.tests.push({
        name,
        status: 'PASSED',
        duration,
        result: result.summary || 'OK'
      });

      console.log(`${colors.green}✅ PASSED${colors.reset} (${duration}ms)`);

      if (result.details) {
        this.log(`   ${result.details}`, 'yellow');
      }

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;

      this.results.failed++;
      this.results.tests.push({
        name,
        status: 'FAILED',
        duration,
        error: error.message
      });

      console.log(`${colors.red}❌ FAILED${colors.reset} (${duration}ms)`);
      this.log(`   Error: ${error.message}`, 'red');

      throw error;
    }
  }

  async testBlocksFound() {
    const url = `${OCEAN_BASE_URL}/data/json/blocksfound`;
    const response = await this.httpGet(url);

    if (response.contentType !== 'json') {
      throw new Error('Response is not JSON');
    }

    const blocks = response.data;

    if (!Array.isArray(blocks)) {
      throw new Error('Response is not an array');
    }

    if (blocks.length === 0) {
      throw new Error('No blocks found in response');
    }

    // Validate first block structure
    const firstBlock = blocks[0];
    const requiredFields = ['solverId', 'solverAddress', 'time', 'height', 'blockHash', 'datumInfo'];

    for (const field of requiredFields) {
      if (!(field in firstBlock)) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    return {
      summary: `${blocks.length} blocks found`,
      details: `Latest: Block ${firstBlock.height} by ${firstBlock.datumInfo?.solverName || 'Unknown'}`
    };
  }

  async testShareWindow() {
    const url = `${OCEAN_BASE_URL}/data/json/sharewindow`;
    const response = await this.httpGet(url);

    if (response.contentType !== 'json') {
      throw new Error('Response is not JSON');
    }

    const shareWindow = response.data;

    if (!shareWindow.date || !shareWindow.size) {
      throw new Error('Missing required fields: date or size');
    }

    const shares = Number(shareWindow.size);
    if (isNaN(shares)) {
      throw new Error('Share size is not a valid number');
    }

    return {
      summary: `${(shares / 1e12).toFixed(2)}T shares`,
      details: `Date: ${shareWindow.date}`
    };
  }

  async testHashRateData(address) {
    const url = `${OCEAN_BASE_URL}/data/csv/hashrates/worker/${address}`;
    const response = await this.httpGet(url);

    if (response.contentType !== 'text') {
      throw new Error('Response is not CSV text');
    }

    const csvData = response.data.trim();
    const lines = csvData.split('\n');

    if (lines.length === 0) {
      return {
        summary: 'No hashrate data',
        details: 'Address may be inactive'
      };
    }

    // Parse first line to validate CSV format
    const firstLine = lines[0].split(',');
    if (firstLine.length !== 3) {
      throw new Error('Invalid CSV format - expected 3 columns');
    }

    const [timestamp, worker, hashRate] = firstLine;

    if (!timestamp || isNaN(parseFloat(hashRate))) {
      throw new Error('Invalid CSV data format');
    }

    // Count non-zero hashrate entries
    const validEntries = lines.filter(line => {
      const parts = line.split(',');
      return parts.length === 3 && parseFloat(parts[2]) > 0;
    });

    return {
      summary: `${validEntries.length}/${lines.length} valid entries`,
      details: validEntries.length > 0 ? `Latest: ${parseFloat(firstLine[2]).toLocaleString()} H/s` : 'No active hashrate'
    };
  }

  async testAddressInBlocksFound(address) {
    const url = `${OCEAN_BASE_URL}/data/json/blocksfound`;
    const response = await this.httpGet(url);
    const blocks = response.data;

    const addressBlocks = blocks.filter(block => block.solverAddress === address);

    return {
      summary: `${addressBlocks.length} blocks found by address`,
      details: addressBlocks.length > 0 ? `Most recent: Block ${addressBlocks[0].height}` : 'No blocks found by this address'
    };
  }

  async testCORSHeaders() {
    const url = `${OCEAN_BASE_URL}/data/json/sharewindow`;

    return new Promise((resolve, reject) => {
      const request = https.get(url, (response) => {
        const corsHeaders = {
          'access-control-allow-origin': response.headers['access-control-allow-origin'],
          'access-control-allow-methods': response.headers['access-control-allow-methods'],
          'access-control-allow-headers': response.headers['access-control-allow-headers']
        };

        const hasCORS = Object.values(corsHeaders).some(header => header !== undefined);

        response.on('data', () => {}); // Consume response
        response.on('end', () => {
          resolve({
            summary: hasCORS ? 'CORS headers present' : 'No CORS headers',
            details: hasCORS ?
              `Origin: ${corsHeaders['access-control-allow-origin'] || 'none'}` :
              'May cause browser CORS issues'
          });
        });
      });

      request.on('error', reject);
      request.setTimeout(5000, () => {
        request.destroy();
        reject(new Error('Timeout'));
      });
    });
  }

  formatDuration(ms) {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  }

  async runAllTests() {
    this.log('\n🌊 Ocean API Integration Test Suite', 'bold');
    this.log('=====================================\n', 'blue');

    const startTime = Date.now();

    try {
      // Core API endpoints
      await this.runTest('Blocks Found API', this.testBlocksFound);
      await this.runTest('Share Window API', this.testShareWindow);
      await this.runTest('HashRate Data API', this.testHashRateData, TEST_ADDRESS);

      // Address-specific tests
      await this.runTest('Address in Blocks', this.testAddressInBlocksFound, TEST_ADDRESS);

      // Browser compatibility
      await this.runTest('CORS Headers', this.testCORSHeaders);

    } catch (error) {
      // Individual test failures are already logged
    }

    const totalDuration = Date.now() - startTime;

    // Print summary
    this.log('\n📊 Test Summary', 'bold');
    this.log('===============', 'blue');
    this.log(`Total tests: ${this.results.passed + this.results.failed}`);
    this.log(`Passed: ${this.results.passed}`, 'green');
    this.log(`Failed: ${this.results.failed}`, this.results.failed > 0 ? 'red' : 'green');
    this.log(`Total time: ${this.formatDuration(totalDuration)}`);

    if (this.results.tests.length > 0) {
      this.log('\n📋 Detailed Results:', 'blue');
      for (const test of this.results.tests) {
        const statusColor = test.status === 'PASSED' ? 'green' : 'red';
        const statusIcon = test.status === 'PASSED' ? '✅' : '❌';
        this.log(`${statusIcon} ${test.name}: ${test.status} (${this.formatDuration(test.duration)})`, statusColor);

        if (test.result) {
          this.log(`   ${test.result}`, 'yellow');
        }
        if (test.error) {
          this.log(`   Error: ${test.error}`, 'red');
        }
      }
    }

    // Exit with appropriate code
    process.exit(this.results.failed > 0 ? 1 : 0);
  }
}

// Run tests if this script is executed directly
const tester = new OceanAPITester();
tester.runAllTests().catch(error => {
  console.error(`${colors.red}Fatal error: ${error.message}${colors.reset}`);
  process.exit(1);
});

export default OceanAPITester;