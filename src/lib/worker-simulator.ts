// Simulate worker data for UI demonstration
// This will be replaced with real Ocean API data when available

import type { WorkerStats } from './types';

const WORKER_NAMES = [
  'BitcoinBucket', 'HashHammer', 'MineralMiner', 'CryptoClaws', 'DigitalDriller',
  'BlockBuster', 'SatoshiShark', 'ProofPirate', 'HashHunter', 'CoinCrusher',
  'ByteBrawler', 'ChainChampion', 'MegaMiner', 'PowerPick', 'TurboTunneler',
  'SpeedyShovel', 'RapidRig', 'MaxiMiner', 'UltraUnit', 'SuperStrike',
  'ThunderTool', 'LightningLoad', 'BoltBeast', 'StormStrike', 'FlashForce'
];

function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

// Generate realistic-looking mining stats based on address
export function generateSimulatedWorkers(address: string, totalHashRate: number): WorkerStats[] {
  const addressHash = simpleHash(address);
  const numWorkers = Math.min(Math.max(3, (addressHash % 21) + 1), 21); // 3-21 workers

  const workers: WorkerStats[] = [];
  let remainingHashRate = totalHashRate;

  for (let i = 0; i < numWorkers; i++) {
    const nameHash = simpleHash(address + i);
    const workerName = WORKER_NAMES[nameHash % WORKER_NAMES.length] + (i > 0 ? `-${i + 1}` : '');

    // Distribute hashrate with some variation
    const percentage = i === numWorkers - 1 ? 1 : (0.3 + (nameHash % 100) / 100 * 0.4); // 30-70% range, last gets remainder
    const workerHashRate = i === numWorkers - 1 ? remainingHashRate : remainingHashRate * percentage;
    remainingHashRate -= workerHashRate;

    // Generate variation in hashrates (60s vs 3hr vs 24hr)
    const variation = 0.8 + (nameHash % 40) / 100; // 80-120% variation
    const hashRate60s = workerHashRate;
    const hashRate3hr = workerHashRate * variation;
    const hashRate24hr = workerHashRate * (0.9 + (nameHash % 20) / 100); // 90-110% of base

    // Generate shares and earnings
    const shares = Math.floor(hashRate60s * 1000000 * (1 + nameHash % 50 / 100));
    const earnings = shares * 0.00000001; // Rough estimate

    // Generate last seen timestamp (within last few hours)
    const lastSeenOffset = (nameHash % 180) * 60 * 1000; // 0-3 hours ago
    const lastSeen = new Date(Date.now() - lastSeenOffset).toISOString();

    workers.push({
      workerName,
      hashRate60s,
      hashRate3hr,
      hashRate24hr,
      lastSeen,
      shares,
      earnings
    });
  }

  // Sort by hashrate descending
  return workers.sort((a, b) => b.hashRate60s - a.hashRate60s);
}

// Generate summary ticker data
export function generateSummaryStats(workers: WorkerStats[]) {
  const totalHashRate = workers.reduce((sum, w) => sum + w.hashRate60s, 0);
  const totalShares = workers.reduce((sum, w) => sum + w.shares, 0);
  const totalEarnings = workers.reduce((sum, w) => sum + w.earnings, 0);
  const activeWorkers = workers.filter(w =>
    new Date(w.lastSeen).getTime() > Date.now() - 60 * 60 * 1000 // Active in last hour
  ).length;

  // Calculate efficiency metrics
  const avgHashRate = totalHashRate / workers.length;
  const topWorkerHashRate = workers[0]?.hashRate60s || 0;
  const efficiency = workers.length > 0 ? (avgHashRate / topWorkerHashRate * 100) : 0;

  return {
    totalHashRate,
    totalShares,
    totalEarnings,
    activeWorkers,
    totalWorkers: workers.length,
    avgHashRate,
    efficiency: Math.min(100, Math.max(0, efficiency))
  };
}