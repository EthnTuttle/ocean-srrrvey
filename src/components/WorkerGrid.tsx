import { generatePirateAvatar } from '../lib/avatar-generator';
import type { WorkerStats } from '../lib/types';

interface WorkerGridProps {
  workers: WorkerStats[];
  maxWorkers?: number;
}

export const WorkerGrid = ({ workers, maxWorkers = 21 }: WorkerGridProps) => {
  const displayWorkers = workers.slice(0, maxWorkers);

  const formatHashRate = (hashRate: number): string => {
    if (hashRate === 0) return '0 H/s';

    const actualHashRate = hashRate * 1e12; // Convert TH/s to H/s

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

  const formatShares = (shares: number): string => {
    if (shares >= 1e12) {
      return `${(shares / 1e12).toFixed(1)}T`;
    } else if (shares >= 1e9) {
      return `${(shares / 1e9).toFixed(1)}B`;
    } else if (shares >= 1e6) {
      return `${(shares / 1e6).toFixed(1)}M`;
    } else if (shares >= 1e3) {
      return `${(shares / 1e3).toFixed(1)}K`;
    } else {
      return shares.toString();
    }
  };

  const getWorkerStatus = (lastSeen: string): { status: string; color: string } => {
    const lastSeenTime = new Date(lastSeen).getTime();
    const now = Date.now();
    const diffMinutes = Math.floor((now - lastSeenTime) / (1000 * 60));

    if (diffMinutes < 5) {
      return { status: 'Active', color: 'text-green-600 dark:text-green-400' };
    } else if (diffMinutes < 30) {
      return { status: 'Recent', color: 'text-yellow-600 dark:text-yellow-400' };
    } else {
      return { status: 'Idle', color: 'text-gray-500 dark:text-gray-400' };
    }
  };

  if (displayWorkers.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
        No worker data available
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Top 3 workers - featured display */}
      {displayWorkers.length > 0 && (
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-xl p-6 border border-blue-200 dark:border-blue-800">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center">
            <span className="mr-2">🏆</span> Top Performers
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {displayWorkers.slice(0, 3).map((worker, idx) => {
              const avatar = generatePirateAvatar(worker.workerName, 60);
              const status = getWorkerStatus(worker.lastSeen);
              return (
                <div key={worker.workerName} className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-md">
                  <div className="flex items-center space-x-3 mb-3">
                    <img src={avatar} alt={worker.workerName} className="w-12 h-12 rounded-full" />
                    <div className="flex-1">
                      <div className="font-medium text-gray-900 dark:text-gray-100">
                        #{idx + 1} {worker.workerName}
                      </div>
                      <div className={`text-xs ${status.color}`}>
                        {status.status}
                      </div>
                    </div>
                  </div>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Hashrate:</span>
                      <span className="font-mono text-blue-600 dark:text-blue-400">
                        {formatHashRate(worker.hashRate60s)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Shares:</span>
                      <span className="font-mono text-green-600 dark:text-green-400">
                        {formatShares(worker.shares)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* All workers grid */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center">
          <span className="mr-2">⚔️</span> Pirate Crew ({displayWorkers.length} workers)
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {displayWorkers.map((worker, idx) => {
            const avatar = generatePirateAvatar(worker.workerName, 40);
            const status = getWorkerStatus(worker.lastSeen);

            return (
              <div key={worker.workerName}
                   className={`relative p-3 rounded-lg border transition-all duration-200 hover:shadow-md ${
                     idx < 3
                       ? 'border-yellow-300 bg-yellow-50 dark:border-yellow-700 dark:bg-yellow-900/20'
                       : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700'
                   }`}>

                {idx < 3 && (
                  <div className="absolute -top-2 -right-2 bg-yellow-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
                    {idx + 1}
                  </div>
                )}

                <div className="flex items-center space-x-3 mb-2">
                  <img src={avatar} alt={worker.workerName} className="w-10 h-10 rounded-full flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate">
                      {worker.workerName}
                    </div>
                    <div className={`text-xs ${status.color}`}>
                      {status.status}
                    </div>
                  </div>
                </div>

                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Rate:</span>
                    <span className="font-mono text-blue-600 dark:text-blue-400">
                      {formatHashRate(worker.hashRate60s)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Shares:</span>
                    <span className="font-mono text-green-600 dark:text-green-400">
                      {formatShares(worker.shares)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};