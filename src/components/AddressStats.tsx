import { useState, useEffect } from 'react';
import { OceanAPI } from '../lib/ocean-api';
import { generateSimulatedWorkers } from '../lib/worker-simulator';
import { WorkerGrid } from './WorkerGrid';
import { SummaryTicker } from './SummaryTicker';
import type { AddressStats, WorkerStats } from '../lib/types';

interface AddressStatsProps {
  address: string;
  onStatsUpdate?: (stats: AddressStats) => void;
}

export const AddressStatsDisplay = ({ address, onStatsUpdate }: AddressStatsProps) => {
  const [stats, setStats] = useState<AddressStats | null>(null);
  const [workers, setWorkers] = useState<WorkerStats[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const oceanApi = new OceanAPI();

  useEffect(() => {
    if (address) {
      fetchStats();
    }
  }, [address]);

  const fetchStats = async () => {
    if (!address.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const addressStats = await oceanApi.getAddressStats(address.trim());
      setStats(addressStats);

      // Generate simulated workers based on the total hashrate
      const simulatedWorkers = generateSimulatedWorkers(address.trim(), addressStats.totalHashRate);
      setWorkers(simulatedWorkers);

      onStatsUpdate?.(addressStats);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch stats');
      setStats(null);
      setWorkers([]);
    } finally {
      setLoading(false);
    }
  };

  const formatHashRate = (hashRate: number): string => {
    if (hashRate === 0) return '0 H/s';

    // Ocean API returns values in TH/s, convert to H/s for proper formatting
    const hashRateInTHs = hashRate;
    const actualHashRate = hashRateInTHs * 1e12; // Convert TH/s to H/s

    if (actualHashRate >= 1e18) {
      return `${(actualHashRate / 1e18).toFixed(1)} EH/s`;
    } else if (actualHashRate >= 1e15) {
      return `${(actualHashRate / 1e15).toFixed(1)} PH/s`;
    } else if (actualHashRate >= 1e12) {
      return `${(actualHashRate / 1e12).toFixed(1)} TH/s`;
    } else if (actualHashRate >= 1e9) {
      return `${(actualHashRate / 1e9).toFixed(1)} GH/s`;
    } else if (actualHashRate >= 1e6) {
      return `${(actualHashRate / 1e6).toFixed(1)} MH/s`;
    } else if (actualHashRate >= 1e3) {
      return `${(actualHashRate / 1e3).toFixed(1)} KH/s`;
    } else {
      return `${actualHashRate.toFixed(1)} H/s`;
    }
  };

  const formatShares = (shares: number): string => {
    if (shares === 0) return '0';

    if (shares >= 1e15) {
      return `${(shares / 1e15).toFixed(2)}P`;
    } else if (shares >= 1e12) {
      return `${(shares / 1e12).toFixed(2)}T`;
    } else if (shares >= 1e9) {
      return `${(shares / 1e9).toFixed(2)}B`;
    } else if (shares >= 1e6) {
      return `${(shares / 1e6).toFixed(2)}M`;
    } else if (shares >= 1e3) {
      return `${(shares / 1e3).toFixed(2)}K`;
    } else {
      return shares.toString();
    }
  };

  const formatTime = (timestamp: string): string => {
    return new Date(timestamp).toLocaleString();
  };

  if (!address.trim()) {
    return (
      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
        Enter a Bitcoin address to view mining stats
      </div>
    );
  }

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-2 text-gray-600 dark:text-gray-400">Loading address stats...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <div className="text-red-600 dark:text-red-400 mb-2">Error loading stats</div>
        <p className="text-sm text-gray-600 dark:text-gray-400">{error}</p>
        <button
          onClick={fetchStats}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
        No stats available
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Ticker - Prominent at top */}
      <SummaryTicker workers={workers} />

      {/* Worker Grid - Main focus */}
      <WorkerGrid workers={workers} maxWorkers={21} />

      {/* Pool Summary - Moved to bottom */}
      {stats && (
        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
          <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-3">Pool Summary</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="text-center">
              <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
                {formatHashRate(stats.totalHashRate)}
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400">Total Hashrate</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-green-600 dark:text-green-400">
                {formatShares(stats.totalShares)}
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400">Total Shares</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-purple-600 dark:text-purple-400">
                {workers.length}
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400">Workers</div>
            </div>
            <div className="text-center">
              <div className="text-xs text-gray-600 dark:text-gray-400">Last Updated</div>
              <div className="text-xs text-gray-500 dark:text-gray-500">
                {formatTime(stats.lastUpdate)}
              </div>
            </div>
          </div>

          <div className="border-t border-gray-300 dark:border-gray-600 pt-3">
            <p className="text-xs font-mono text-gray-600 dark:text-gray-400 break-all">
              <span className="font-medium">Address:</span> {stats.address}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};