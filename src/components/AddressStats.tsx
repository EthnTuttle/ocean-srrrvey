import { useState, useEffect } from 'react';
import { OceanAPI } from '../lib/ocean-api';
import type { AddressStats } from '../lib/types';

interface AddressStatsProps {
  address: string;
  onStatsUpdate?: (stats: AddressStats) => void;
}

export const AddressStatsDisplay = ({ address, onStatsUpdate }: AddressStatsProps) => {
  const [stats, setStats] = useState<AddressStats | null>(null);
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
      onStatsUpdate?.(addressStats);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch stats');
      setStats(null);
    } finally {
      setLoading(false);
    }
  };

  const formatHashRate = (hashRate: number): string => {
    if (hashRate === 0) return '0 H/s';

    if (hashRate >= 1e18) {
      return `${(hashRate / 1e18).toFixed(2)} EH/s`;
    } else if (hashRate >= 1e15) {
      return `${(hashRate / 1e15).toFixed(2)} PH/s`;
    } else if (hashRate >= 1e12) {
      return `${(hashRate / 1e12).toFixed(2)} TH/s`;
    } else if (hashRate >= 1e9) {
      return `${(hashRate / 1e9).toFixed(2)} GH/s`;
    } else if (hashRate >= 1e6) {
      return `${(hashRate / 1e6).toFixed(2)} MH/s`;
    } else {
      return `${hashRate.toFixed(2)} H/s`;
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
      {/* Address Overview */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Address Overview
        </h3>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {formatHashRate(stats.totalHashRate)}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Current Hashrate</div>
          </div>

          <div className="text-center">
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              {formatShares(stats.totalShares)}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Total Shares</div>
          </div>

          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
              {stats.activeWorkers}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Active Workers</div>
          </div>

          <div className="text-center">
            <div className="text-sm text-gray-600 dark:text-gray-400">Last Updated</div>
            <div className="text-xs text-gray-500 dark:text-gray-500">
              {formatTime(stats.lastUpdate)}
            </div>
          </div>
        </div>
      </div>

      {/* Workers Table */}
      {stats.workers.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              Worker Details
            </h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Worker
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Hashrate (60s)
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Hashrate (3hr)
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Shares
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Last Seen
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {stats.workers.map((worker, idx) => (
                  <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                      {worker.workerName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                      {formatHashRate(worker.hashRate60s)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                      {formatHashRate(worker.hashRate3hr)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                      {formatShares(worker.shares)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-500">
                      {formatTime(worker.lastSeen)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Address Details */}
      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
        <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">Address</h4>
        <p className="text-sm font-mono text-gray-600 dark:text-gray-400 break-all">
          {stats.address}
        </p>
      </div>
    </div>
  );
};