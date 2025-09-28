import { useState, useEffect, useRef } from 'react';
import { useSeoMeta } from '@unhead/react';
import { SurveyService } from '../lib/survey-service';
import { AddressStatsDisplay } from '../components/AddressStats';
import type { OceanSurveyData, NostrSurveyNote, AddressStats } from '../lib/types';

const Index = () => {
  useSeoMeta({
    title: 'Ocean Srrrvey - Bitcoin Mining Pool Monitor',
    description: 'Monitor Ocean mining pool data and share findings on Nostr',
  });

  const [surveyService] = useState(() => new SurveyService());
  const [currentSurvey, setCurrentSurvey] = useState<OceanSurveyData | null>(null);
  const [otherSurveys, setOtherSurveys] = useState<NostrSurveyNote[]>([]);
  const [matchingResults, setMatchingResults] = useState<Array<{ survey: NostrSurveyNote; matchScore: number; isRecent: boolean }>>([]);
  const [isActive, setIsActive] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [inputAddress, setInputAddress] = useState('bc1q6f3ged3f74sga3z2cgeyehv5f9lu9r6p5arqvf44yzsy4gtjxtlsmnhn8j');
  const [currentAddress, setCurrentAddress] = useState('bc1q6f3ged3f74sga3z2cgeyehv5f9lu9r6p5arqvf44yzsy4gtjxtlsmnhn8j');
  const [addressStats, setAddressStats] = useState<AddressStats | null>(null);
  const reloadTimeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    // Generate new key and start survey when page opens
    startSurvey();

    // Set up page reload after 1 minute
    reloadTimeoutRef.current = setTimeout(() => {
      window.location.reload();
    }, 60 * 1000);

    return () => {
      if (reloadTimeoutRef.current) {
        clearTimeout(reloadTimeoutRef.current);
      }
      surveyService.disconnect();
    };
  }, []);

  const handleAddressSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputAddress.trim() && inputAddress !== currentAddress) {
      setCurrentAddress(inputAddress.trim());
      startSurvey(inputAddress.trim());
    }
  };

  const handleAddressStatsUpdate = (stats: AddressStats) => {
    setAddressStats(stats);
  };

  const startSurvey = async (address?: string) => {
    const targetAddress = address || currentAddress;

    try {
      console.log(`Starting new survey session for ${targetAddress}...`);
      setIsActive(true);

      // Perform initial survey
      const initialSurvey = await surveyService.performSurvey(targetAddress);
      setCurrentSurvey(initialSurvey);
      setLastUpdate(new Date());

      // Fetch other recent surveys
      const recentSurveys = await surveyService.fetchRecentSurveys();
      setOtherSurveys(recentSurveys);

      // Compare with others
      const matches = surveyService.compareWithOtherSurveys(initialSurvey, recentSurveys);
      setMatchingResults(matches);

      // Start periodic updates every 30 seconds
      const updateInterval = setInterval(async () => {
        try {
          const newSurveys = await surveyService.fetchRecentSurveys();
          setOtherSurveys(newSurveys);

          if (currentSurvey) {
            const newMatches = surveyService.compareWithOtherSurveys(currentSurvey, newSurveys);
            setMatchingResults(newMatches);
          }
        } catch (error) {
          console.error('Error updating surveys:', error);
        }
      }, 30000);

      // Clean up interval after 50 seconds (before page reload)
      setTimeout(() => clearInterval(updateInterval), 50000);

    } catch (error) {
      console.error('Error starting survey:', error);
      setIsActive(false);
    }
  };

  const formatAddress = (address: string) => {
    if (address.length <= 20) return address;
    return `${address.slice(0, 10)}...${address.slice(-10)}`;
  };

  const formatTime = (timestamp: string | number) => {
    const date = typeof timestamp === 'string' ? new Date(timestamp) : new Date(timestamp * 1000);
    return date.toLocaleTimeString();
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
      <div className="max-w-6xl mx-auto">
        <header className="mb-8 text-center">
          <h1 className="text-4xl font-bold mb-2 text-gray-900 dark:text-gray-100">
            Ocean Srrrvey 🌊⛏️
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            Bitcoin Mining Pool Monitor & Nostr Reporter
          </p>

          {/* Address Input Form */}
          <form onSubmit={handleAddressSubmit} className="mt-6 max-w-2xl mx-auto">
            <div className="flex gap-2">
              <input
                type="text"
                value={inputAddress}
                onChange={(e) => setInputAddress(e.target.value)}
                placeholder="Enter Bitcoin address to monitor..."
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-800 dark:text-gray-100 text-sm"
              />
              <button
                type="submit"
                disabled={!inputAddress.trim() || inputAddress === currentAddress}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors text-sm"
              >
                Monitor
              </button>
            </div>
          </form>

          <div className="mt-4 text-sm text-gray-500">
            Currently monitoring: {formatAddress(currentAddress)}
          </div>
        </header>

        {/* Main Content - Worker Statistics */}
        <div className="mb-8">
          <AddressStatsDisplay
            address={currentAddress}
            onStatsUpdate={handleAddressStatsUpdate}
          />
        </div>

        {/* Nostr Survey Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Current Survey Results */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                Current Survey
              </h2>
              <div className={`px-3 py-1 rounded-full text-sm ${
                isActive
                  ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                  : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
              }`}>
                {isActive ? 'Active' : 'Inactive'}
              </div>
            </div>

            {currentSurvey ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h3 className="font-medium text-gray-700 dark:text-gray-300">Discovery Score</h3>
                    <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                      {currentSurvey.discoveryScore}
                    </p>
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-700 dark:text-gray-300">Survey Time</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {formatTime(currentSurvey.timestamp)}
                    </p>
                  </div>
                </div>

                <div>
                  <h3 className="font-medium text-gray-700 dark:text-gray-300 mb-2">Recent Pool Blocks</h3>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {currentSurvey.blocksFound.slice(0, 5).map((block, idx) => (
                      <div key={idx} className="text-sm bg-gray-50 dark:bg-gray-700 p-2 rounded">
                        <div className="font-mono text-xs text-gray-500 dark:text-gray-400">
                          Block {block.height}
                        </div>
                        <div className="text-gray-700 dark:text-gray-300">
                          {block.datumInfo.solverName || 'Unknown'} - {formatTime(block.time)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="font-medium text-gray-700 dark:text-gray-300">Pool Share Window</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {currentSurvey.shareWindow.size.toLocaleString()} shares
                  </p>
                </div>

                <div>
                  <h3 className="font-medium text-gray-700 dark:text-gray-300">Nostr Identity</h3>
                  <p className="text-xs font-mono text-gray-500 dark:text-gray-400 break-all">
                    {surveyService.getNostrClient().getNpub()}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    🏴‍☠️ pirating the Ocean 🏴‍☠️
                  </p>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-2 text-gray-600 dark:text-gray-400">Performing survey...</p>
              </div>
            )}
          </div>

          {/* Other Surveys & Comparisons */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
              Community Findings
            </h2>

            {matchingResults.length > 0 ? (
              <div className="space-y-4">
                <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                  Found {matchingResults.length} matching survey(s) from other surveyors
                </div>

                {matchingResults.map((result, idx) => (
                  <div key={idx} className="border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        Surveyor: {result.survey.pubkey.slice(0, 16)}...
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className={`px-2 py-1 rounded text-xs ${
                          result.matchScore > 0.8
                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                            : result.matchScore > 0.6
                            ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                            : 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
                        }`}>
                          {Math.round(result.matchScore * 100)}% match
                        </div>
                        {result.isRecent && (
                          <div className="px-2 py-1 bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 rounded text-xs">
                            Recent
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="text-sm text-gray-700 dark:text-gray-300">
                      Discovery Score: {result.survey.discoveryScore || 'N/A'}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {formatTime(result.survey.created_at)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-600 dark:text-gray-400">
                  {otherSurveys.length === 0
                    ? 'Loading community surveys...'
                    : 'No matching surveys found from other users'
                  }
                </p>
                {otherSurveys.length > 0 && (
                  <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
                    {otherSurveys.length} total surveys found
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        <footer className="mt-8 text-center text-sm text-gray-500 dark:text-gray-400">
          <p>
            Page will reload in {lastUpdate ? Math.max(0, 60 - Math.floor((Date.now() - lastUpdate.getTime()) / 1000)) : 60}s
          </p>
          <p className="mt-1">
            Using #ocean-srrrvey hashtag on Nostr for data sharing
          </p>
        </footer>
      </div>
    </div>
  );
};

export default Index;
