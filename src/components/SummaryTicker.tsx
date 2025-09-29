import { useEffect, useState } from 'react';
import type { WorkerStats } from '../lib/types';

interface SummaryTickerProps {
  workers: WorkerStats[];
}

interface TickerStat {
  label: string;
  value: string;
  icon: string;
  color: string;
}

export const SummaryTicker = ({ workers }: SummaryTickerProps) => {
  const [currentStatIndex, setCurrentStatIndex] = useState(0);

  const formatHashRate = (hashRate: number): string => {
    if (hashRate === 0) return '0 H/s';
    const actualHashRate = hashRate * 1e12;

    if (actualHashRate >= 1e15) {
      return `${(actualHashRate / 1e15).toFixed(1)} PH/s`;
    } else if (actualHashRate >= 1e12) {
      return `${(actualHashRate / 1e12).toFixed(1)} TH/s`;
    } else if (actualHashRate >= 1e9) {
      return `${(actualHashRate / 1e9).toFixed(1)} GH/s`;
    } else {
      return `${(actualHashRate / 1e6).toFixed(1)} MH/s`;
    }
  };

  const formatNumber = (num: number): string => {
    if (num >= 1e12) return `${(num / 1e12).toFixed(1)}T`;
    if (num >= 1e9) return `${(num / 1e9).toFixed(1)}B`;
    if (num >= 1e6) return `${(num / 1e6).toFixed(1)}M`;
    if (num >= 1e3) return `${(num / 1e3).toFixed(1)}K`;
    return num.toString();
  };

  // Calculate statistics
  const totalHashRate = workers.reduce((sum, w) => sum + w.hashRate60s, 0);
  const totalShares = workers.reduce((sum, w) => sum + w.shares, 0);
  const totalEarnings = workers.reduce((sum, w) => sum + w.earnings, 0);

  const activeWorkers = workers.filter(w =>
    new Date(w.lastSeen).getTime() > Date.now() - 60 * 60 * 1000
  ).length;

  const avgHashRate = workers.length > 0 ? totalHashRate / workers.length : 0;
  const topWorkerHashRate = workers[0]?.hashRate60s || 0;
  const efficiency = workers.length > 0 && topWorkerHashRate > 0
    ? Math.min(100, (avgHashRate / topWorkerHashRate) * 100)
    : 0;

  const stats: TickerStat[] = [
    {
      label: 'Total Hashrate',
      value: formatHashRate(totalHashRate),
      icon: '⚡',
      color: 'text-yellow-600 dark:text-yellow-400'
    },
    {
      label: 'Active Workers',
      value: `${activeWorkers}/${workers.length}`,
      icon: '👥',
      color: 'text-green-600 dark:text-green-400'
    },
    {
      label: 'Total Shares',
      value: formatNumber(totalShares),
      icon: '💎',
      color: 'text-blue-600 dark:text-blue-400'
    },
    {
      label: 'Efficiency',
      value: `${efficiency.toFixed(1)}%`,
      icon: '📊',
      color: 'text-purple-600 dark:text-purple-400'
    },
    {
      label: 'Avg Hashrate',
      value: formatHashRate(avgHashRate),
      icon: '📈',
      color: 'text-orange-600 dark:text-orange-400'
    },
    {
      label: 'Total Earnings',
      value: `${totalEarnings.toFixed(8)} BTC`,
      icon: '💰',
      color: 'text-green-600 dark:text-green-400'
    }
  ];

  // Rotate through stats every 3 seconds
  useEffect(() => {
    if (stats.length === 0) return;

    const interval = setInterval(() => {
      setCurrentStatIndex((prev) => (prev + 1) % stats.length);
    }, 3000);

    return () => clearInterval(interval);
  }, [stats.length]);

  if (workers.length === 0) {
    return (
      <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4">
        <div className="text-center text-gray-500 dark:text-gray-400">
          No worker data available
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-r from-gray-900 via-blue-900 to-gray-900 text-white rounded-lg p-4 shadow-lg">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <span className="text-2xl">🏴‍☠️</span>
          <div>
            <div className="text-sm text-gray-300">Live Stats</div>
            <div className="text-xs text-gray-400">Auto-updating every 3s</div>
          </div>
        </div>

        {/* Main rotating stat */}
        <div className="flex-1 text-center">
          <div className="transition-all duration-500 ease-in-out">
            <div className={`text-3xl ${stats[currentStatIndex]?.color || 'text-white'}`}>
              {stats[currentStatIndex]?.icon} {stats[currentStatIndex]?.value}
            </div>
            <div className="text-sm text-gray-300 mt-1">
              {stats[currentStatIndex]?.label}
            </div>
          </div>
        </div>

        {/* Quick stats preview */}
        <div className="hidden md:block">
          <div className="text-right space-y-1">
            <div className="text-xs text-gray-400">Quick View:</div>
            <div className="text-sm">
              <span className="text-yellow-400">{formatHashRate(totalHashRate)}</span>
              <span className="text-gray-400 mx-2">•</span>
              <span className="text-green-400">{activeWorkers} Active</span>
            </div>
          </div>
        </div>
      </div>

      {/* Progress indicators */}
      <div className="flex justify-center mt-3 space-x-1">
        {stats.map((_, idx) => (
          <div
            key={idx}
            className={`h-1 w-8 rounded-full transition-all duration-300 ${
              idx === currentStatIndex
                ? 'bg-white'
                : 'bg-gray-600'
            }`}
          />
        ))}
      </div>
    </div>
  );
};