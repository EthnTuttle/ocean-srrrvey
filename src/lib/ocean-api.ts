import type { BlockFoundData, ShareWindowData, HashRateData, OceanSurveyData, AddressStats, WorkerStats } from './types';

export class OceanAPI {
  private readonly baseUrl: string;

  constructor() {
    // Use different strategies for dev vs production to handle CORS
    if (import.meta.env.DEV) {
      // Development: use Vite proxy
      this.baseUrl = '/api/ocean';
    } else {
      // Production: use CORS proxy service
      this.baseUrl = 'https://corsproxy.io/?https://ocean.xyz';
    }
  }

  async getBlocksFound(): Promise<BlockFoundData[]> {
    try {
      const response = await fetch(`${this.baseUrl}/data/json/blocksfound`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error('Error fetching blocks found:', error);
      return [];
    }
  }

  async getShareWindow(): Promise<ShareWindowData> {
    try {
      const response = await fetch(`${this.baseUrl}/data/json/sharewindow`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error('Error fetching share window:', error);
      return { date: new Date().toISOString(), size: 0 };
    }
  }

  async getHashRateData(address: string): Promise<HashRateData[]> {
    try {
      const response = await fetch(`${this.baseUrl}/data/csv/hashrates/worker/${address}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const csvText = await response.text();
      return this.parseHashRateCSV(csvText);
    } catch (error) {
      console.error('Error fetching hashrate data:', error);
      return [];
    }
  }

  private parseHashRateCSV(csvText: string): HashRateData[] {
    const lines = csvText.trim().split('\n');
    return lines.map(line => {
      const parts = line.split(',');
      // Format appears to be: timestamp, (empty), hashrate_in_GH/s
      const timestamp = parts[0];
      const hashRateStr = parts[2]; // Hashrate is in the third column
      const hashRateGHs = parseFloat(hashRateStr) || 0;
      const hashRate = hashRateGHs / 1000; // Convert GH/s to TH/s

      return {
        timestamp: timestamp || new Date().toISOString(),
        worker: '', // Worker info not available in this CSV
        hashRate: hashRate // Convert to TH/s for consistency
      };
    }).filter(item => item.hashRate > 0);
  }

  private calculateDiscoveryScore(data: {
    blocksFound: BlockFoundData[];
    shareWindow: ShareWindowData;
    hashRateData: HashRateData[];
    address: string;
  }): number {
    let score = 0;

    // Base score for having data
    if (data.blocksFound.length > 0) score += 10;
    if (data.hashRateData.length > 0) score += 10;
    if (data.shareWindow.size > 0) score += 5;

    // Recent blocks found by this address
    const addressBlocks = data.blocksFound.filter(block =>
      block.solverAddress === data.address
    );
    score += addressBlocks.length * 15;

    // Recent activity (blocks in last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recentBlocks = data.blocksFound.filter(block =>
      new Date(block.time) > sevenDaysAgo
    );
    score += recentBlocks.length * 2;

    // Hashrate consistency (higher score for consistent hashrate)
    if (data.hashRateData.length > 1) {
      const hashRates = data.hashRateData.map(h => h.hashRate);
      const avgHashRate = hashRates.reduce((a, b) => a + b, 0) / hashRates.length;
      const variance = hashRates.reduce((acc, rate) =>
        acc + Math.pow(rate - avgHashRate, 2), 0
      ) / hashRates.length;
      const coefficient = Math.sqrt(variance) / avgHashRate;
      score += Math.max(0, 10 - (coefficient * 10)); // Lower coefficient = higher score
    }

    // Share window contribution
    if (data.shareWindow.size > 1000000000000) { // 1T shares
      score += 5;
    }

    return Math.round(score * 100) / 100; // Round to 2 decimal places
  }

  async createSurveyData(
    address: string,
    surveyorPubkey: string
  ): Promise<OceanSurveyData> {
    const timestamp = new Date().toISOString();

    const [blocksFound, shareWindow, hashRateData] = await Promise.all([
      this.getBlocksFound(),
      this.getShareWindow(),
      this.getHashRateData(address)
    ]);

    const discoveryScore = this.calculateDiscoveryScore({
      blocksFound,
      shareWindow,
      hashRateData,
      address
    });

    return {
      address,
      timestamp,
      blocksFound,
      shareWindow,
      hashRateData,
      discoveryScore,
      surveyor: surveyorPubkey
    };
  }

  // Try to get real worker data from Ocean's interface
  async getRealWorkerData(address: string): Promise<WorkerStats[]> {
    try {
      // This would be the ideal endpoint, but it may not be publicly accessible
      const response = await fetch(`${this.baseUrl}/template/workers/rows?address=${address}&limit=21`);

      if (!response.ok) {
        console.warn('Ocean workers API not accessible, falling back to simulation');
        return [];
      }

      const html = await response.text();

      // Parse HTML to extract worker data (this is fragile but better than fake data)
      // In practice, Ocean would provide a JSON API for this
      const workerMatches = html.matchAll(/<tr[^>]*>[\s\S]*?<\/tr>/g);
      const workers: WorkerStats[] = [];

      for (const match of workerMatches) {
        const row = match[0];
        // Extract worker name, hashrate, etc. from HTML
        const nameMatch = row.match(/class="worker-name"[^>]*>([^<]+)</);
        const hashrateMatch = row.match(/class="hashrate"[^>]*>([^<]+)</);

        if (nameMatch && hashrateMatch) {
          workers.push({
            workerName: nameMatch[1].trim(),
            hashRate60s: parseFloat(hashrateMatch[1]) || 0,
            hashRate3hr: parseFloat(hashrateMatch[1]) || 0,
            hashRate24hr: parseFloat(hashrateMatch[1]) || 0,
            lastSeen: new Date().toISOString(),
            shares: 0,
            earnings: 0
          });
        }
      }

      return workers.slice(0, 21); // Top 21 workers
    } catch (error) {
      console.warn('Failed to fetch real worker data:', error);
      return [];
    }
  }

  async getAddressStats(address: string): Promise<AddressStats> {
    try {
      // Get hashrate data for the address
      const hashRateData = await this.getHashRateData(address);

      // Get recent blocks to see if this address has found any
      const blocksFound = await this.getBlocksFound();
      const addressBlocks = blocksFound.filter(block =>
        block.solverAddress === address
      );

      // Calculate stats from available data
      const currentHashRate = hashRateData.length > 0
        ? hashRateData[hashRateData.length - 1].hashRate
        : 0;

      const avgHashRate = hashRateData.length > 0
        ? hashRateData.reduce((sum, rate) => sum + rate.hashRate, 0) / hashRateData.length
        : 0;

      // Try to get real worker data first, fall back to simulation
      let workers: WorkerStats[] = await this.getRealWorkerData(address);

      if (workers.length === 0) {
        // Fallback: create a single worker entry representing the address
        workers = hashRateData.length > 0 ? [{
          workerName: `${address.slice(-8)}`, // Use address suffix as worker name
          hashRate60s: currentHashRate,
          hashRate3hr: avgHashRate,
          hashRate24hr: avgHashRate,
          lastSeen: hashRateData[hashRateData.length - 1]?.timestamp || new Date().toISOString(),
          shares: addressBlocks.reduce((sum, block) => sum + block.acceptedShares, 0),
          earnings: 0 // Not available from API
        }] : [];
      }

      return {
        address,
        totalHashRate: currentHashRate,
        totalShares: addressBlocks.reduce((sum, block) => sum + block.acceptedShares, 0),
        totalEarnings: 0, // Not available from API
        activeWorkers: workers.filter(w =>
          new Date(w.lastSeen).getTime() > Date.now() - 60 * 60 * 1000
        ).length,
        workers,
        lastUpdate: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error fetching address stats:', error);
      return {
        address,
        totalHashRate: 0,
        totalShares: 0,
        totalEarnings: 0,
        activeWorkers: 0,
        workers: [],
        lastUpdate: new Date().toISOString()
      };
    }
  }

  async getPoolStatus(): Promise<string | null> {
    try {
      const response = await fetch(`${this.baseUrl}/template/poolstatus`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.text(); // Returns HTML template
    } catch (error) {
      console.error('Error fetching pool status:', error);
      return null;
    }
  }
}