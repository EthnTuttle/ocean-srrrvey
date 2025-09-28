import { useState } from 'react';
import { OceanAPI } from '../lib/ocean-api';
import { SurveyService } from '../lib/survey-service';

const Debug = () => {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const oceanApi = new OceanAPI();
  const surveyService = new SurveyService();

  const testEndpoints = async () => {
    setLoading(true);
    setError(null);
    setResults(null);

    try {
      console.log('Testing Ocean API endpoints...');

      // Test each endpoint
      const tests = [
        { name: 'Blocks Found', test: () => oceanApi.getBlocksFound() },
        { name: 'Share Window', test: () => oceanApi.getShareWindow() },
        { name: 'Address Stats', test: () => oceanApi.getAddressStats('bc1q6f3ged3f74sga3z2cgeyehv5f9lu9r6p5arqvf44yzsy4gtjxtlsmnhn8j') },
        { name: 'HashRate Data', test: () => oceanApi.getHashRateData('bc1q6f3ged3f74sga3z2cgeyehv5f9lu9r6p5arqvf44yzsy4gtjxtlsmnhn8j') },
      ];

      const testResults: any = {};

      for (const test of tests) {
        try {
          console.log(`Testing ${test.name}...`);
          const result = await test.test();
          testResults[test.name] = {
            success: true,
            data: Array.isArray(result) ? `Array with ${result.length} items` : result,
            sample: Array.isArray(result) ? result.slice(0, 2) : result
          };
          console.log(`✅ ${test.name}:`, result);
        } catch (err) {
          testResults[test.name] = {
            success: false,
            error: err instanceof Error ? err.message : String(err)
          };
          console.error(`❌ ${test.name}:`, err);
        }
      }

      // Test Survey Service
      try {
        console.log('Testing Survey Service...');
        const survey = await surveyService.performSurvey('bc1q6f3ged3f74sga3z2cgeyehv5f9lu9r6p5arqvf44yzsy4gtjxtlsmnhn8j');
        testResults['Survey Service'] = {
          success: true,
          data: survey,
          npub: surveyService.getNostrClient().getNpub()
        };
        console.log('✅ Survey Service:', survey);
      } catch (err) {
        testResults['Survey Service'] = {
          success: false,
          error: err instanceof Error ? err.message : String(err)
        };
        console.error('❌ Survey Service:', err);
      }

      setResults(testResults);

    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      console.error('Test failed:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6 text-gray-900 dark:text-gray-100">
          🔧 Ocean Srrrvey Debug Page
        </h1>

        <div className="mb-6">
          <button
            onClick={testEndpoints}
            disabled={loading}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {loading ? 'Testing APIs...' : 'Test All Endpoints'}
          </button>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-100 border border-red-300 rounded-lg">
            <h3 className="font-bold text-red-800 mb-2">Error:</h3>
            <p className="text-red-700 font-mono text-sm">{error}</p>
          </div>
        )}

        {results && (
          <div className="space-y-4">
            {Object.entries(results).map(([name, result]: [string, any]) => (
              <div
                key={name}
                className={`p-4 rounded-lg border ${
                  result.success
                    ? 'bg-green-50 border-green-200 dark:bg-green-900 dark:border-green-700'
                    : 'bg-red-50 border-red-200 dark:bg-red-900 dark:border-red-700'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">
                    {result.success ? '✅' : '❌'}
                  </span>
                  <h3 className="font-bold text-lg">{name}</h3>
                </div>

                {result.success ? (
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                      {result.data}
                    </p>
                    {result.sample && (
                      <details className="mt-2">
                        <summary className="cursor-pointer text-sm text-blue-600 hover:text-blue-800">
                          View Sample Data
                        </summary>
                        <pre className="mt-2 p-2 bg-gray-100 dark:bg-gray-800 rounded text-xs overflow-auto">
                          {JSON.stringify(result.sample, null, 2)}
                        </pre>
                      </details>
                    )}
                    {result.npub && (
                      <p className="text-xs font-mono text-gray-500 mt-2">
                        Nostr: {result.npub}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-red-700 dark:text-red-300 font-mono text-sm">
                    {result.error}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="mt-8 p-4 bg-blue-50 dark:bg-blue-900 rounded-lg">
          <h3 className="font-bold mb-2">Quick Access:</h3>
          <div className="space-y-2 text-sm">
            <p>🌊 <strong>Local Dev:</strong> <a href="http://localhost:8082" className="text-blue-600 hover:underline">http://localhost:8082</a></p>
            <p>🏴‍☠️ <strong>GitHub Pages:</strong> <a href="https://ethntuttle.github.io/ocean-srrrvey/" className="text-blue-600 hover:underline">https://ethntuttle.github.io/ocean-srrrvey/</a></p>
            <p>⚡ <strong>Repository:</strong> <a href="https://github.com/EthnTuttle/ocean-srrrvey" className="text-blue-600 hover:underline">https://github.com/EthnTuttle/ocean-srrrvey</a></p>
          </div>
        </div>

        <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-900 rounded-lg">
          <h3 className="font-bold mb-2">🧪 Testing Notes:</h3>
          <ul className="text-sm space-y-1">
            <li>• Check browser console for detailed logs</li>
            <li>• CORS errors indicate browser security restrictions</li>
            <li>• Ocean API should return real-time mining data</li>
            <li>• Survey service generates unique Nostr keys per session</li>
            <li>• Hashrate data may be empty for inactive addresses</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default Debug;