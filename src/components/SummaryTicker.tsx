import { useEffect, useState } from 'react';
import type { WorkerStats } from '../lib/types';

interface SummaryTickerProps {
  workers: WorkerStats[];
}

export const SummaryTicker = ({ workers }: SummaryTickerProps) => {
  const [currentWorkerIndex, setCurrentWorkerIndex] = useState(0);

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

  const formatTime = (timestamp: string): string => {
    const now = Date.now();
    const lastSeen = new Date(timestamp).getTime();
    const diff = now - lastSeen;

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0) return `${hours}h ${minutes}m ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  };

  // Rotate through workers every 4 seconds
  useEffect(() => {
    if (workers.length === 0) return;

    const interval = setInterval(() => {
      setCurrentWorkerIndex((prev) => (prev + 1) % workers.length);
    }, 4000);

    return () => clearInterval(interval);
  }, [workers.length]);

  if (workers.length === 0) {
    return (
      <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4">
        <div className="text-center text-gray-500 dark:text-gray-400">
          No pirate crew available
        </div>
      </div>
    );
  }

  const currentWorker = workers[currentWorkerIndex];

  return (
    <div className="bg-gradient-to-r from-gray-800 via-blue-800 to-gray-800 text-white rounded-lg p-4 shadow-lg">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <span className="text-2xl">⚔️</span>
          <div>
            <div className="text-sm text-gray-300">Crew Member Ticker</div>
            <div className="text-xs text-gray-400">Cycling every 4s</div>
          </div>
        </div>

        {/* Current worker display */}
        <div className="flex-1 text-center">
          <div className="transition-all duration-500 ease-in-out">
            <div className="text-2xl font-bold text-yellow-400 mb-1">
              {currentWorker?.workerName || 'Unknown Pirate'}
            </div>
            <div className="text-lg text-green-400 mb-1">
              {formatHashRate(currentWorker?.hashRate60s || 0)}
            </div>
            <div className="text-sm text-gray-300">
              {formatNumber(currentWorker?.shares || 0)} shares • Last seen {formatTime(currentWorker?.lastSeen || new Date().toISOString())}
            </div>
          </div>
        </div>

        {/* Progress info */}
        <div className="hidden md:block">
          <div className="text-right space-y-1">
            <div className="text-xs text-gray-400">Crew Progress:</div>
            <div className="text-sm">
              <span className="text-yellow-400">{currentWorkerIndex + 1}</span>
              <span className="text-gray-400 mx-1">/</span>
              <span className="text-green-400">{workers.length}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Progress indicators */}
      <div className="flex justify-center mt-3 space-x-1">
        {workers.slice(0, Math.min(10, workers.length)).map((_, idx) => (
          <div
            key={idx}
            className={`h-1 w-6 rounded-full transition-all duration-300 ${
              idx === currentWorkerIndex % 10
                ? 'bg-yellow-400'
                : 'bg-gray-600'
            }`}
          />
        ))}
        {workers.length > 10 && (
          <div className="text-xs text-gray-400 ml-2">
            +{workers.length - 10} more
          </div>
        )}
      </div>
    </div>
  );
};