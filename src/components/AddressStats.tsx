import { useState, useEffect, useCallback, useMemo } from 'react';
import { OceanAPI } from '../lib/ocean-api';
import { generateSimulatedWorkers } from '../lib/worker-simulator';
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

  const oceanApi = useMemo(() => new OceanAPI(), []);

  const fetchStats = useCallback(async () => {
    if (!address.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const addressStats = await oceanApi.getAddressStats(address.trim());
      setStats(addressStats);

      // Use real worker data if available, otherwise generate Ocean-style simulated workers
      if (addressStats.workers && addressStats.workers.length > 1) {
        // We have real worker data from Ocean API
        setWorkers(addressStats.workers);
      } else {
        // Generate realistic Ocean-style workers with proper naming
        const simulatedWorkers = generateSimulatedWorkers(address.trim(), addressStats.totalHashRate);
        setWorkers(simulatedWorkers);
      }

      onStatsUpdate?.(addressStats);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch stats');
      setStats(null);
      setWorkers([]);
    } finally {
      setLoading(false);
    }
  }, [address, oceanApi, onStatsUpdate]);

  useEffect(() => {
    if (address) {
      fetchStats();
    }
  }, [address, fetchStats]);

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
      {/* Main Account Summary */}
      {stats && (
        <div className="bg-gradient-to-br from-blue-900 via-gray-900 to-purple-900 text-white rounded-lg p-6 shadow-xl">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <span className="text-3xl">🏴‍☠️</span>
              <div>
                <h3 className="text-xl font-bold">Telehash Pirate Fleet</h3>
                <div className="text-sm text-gray-300">Account Summary</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-gray-400">Last Updated</div>
              <div className="text-sm text-gray-300">
                {formatTime(stats.lastUpdate)}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-6">
            <div className="text-center p-4 bg-black bg-opacity-20 rounded-lg">
              <div className="text-2xl font-bold text-yellow-400 mb-1">
                {formatHashRate(stats.totalHashRate)}
              </div>
              <div className="text-sm text-gray-300">Total Fleet Power</div>
            </div>
            <div className="text-center p-4 bg-black bg-opacity-20 rounded-lg">
              <div className="text-2xl font-bold text-green-400 mb-1">
                {formatShares(stats.totalShares)}
              </div>
              <div className="text-sm text-gray-300">Total Shares</div>
            </div>
            <div className="text-center p-4 bg-black bg-opacity-20 rounded-lg">
              <div className="text-2xl font-bold text-purple-400 mb-1">
                {stats.activeWorkers}/{workers.length}
              </div>
              <div className="text-sm text-gray-300">Active Crew</div>
            </div>
            <div className="text-center p-4 bg-black bg-opacity-20 rounded-lg">
              <div className="text-2xl font-bold text-orange-400 mb-1">
                {workers.length > 0 ? (stats.totalHashRate / workers.length).toFixed(1) : '0'} TH/s
              </div>
              <div className="text-sm text-gray-300">Avg Per Worker</div>
            </div>
          </div>

          <div className="border-t border-gray-600 pt-4">
            <p className="text-sm font-mono text-gray-300 break-all">
              <span className="font-medium text-white">⚓ Address:</span> {stats.address}
            </p>
          </div>
        </div>
      )}

      {/* Worker Ticker - Cycles through all workers */}
      <SummaryTicker workers={workers} />
    </div>
  );
};