import { describe, it, expect, vi } from 'vitest';
import { OceanAPI } from './ocean-api';

// Mock fetch for testing
global.fetch = vi.fn();

const mockFetch = fetch as vi.MockedFunction<typeof fetch>;

describe('OceanAPI', () => {
  let oceanApi: OceanAPI;

  beforeEach(() => {
    oceanApi = new OceanAPI();
    mockFetch.mockClear();
  });

  describe('getBlocksFound', () => {
    it('should fetch and return blocks found data', async () => {
      const mockData = [
        {
          solverId: 4107,
          solverAddress: 'bc1qtest',
          time: '2025-09-28T18:55:07.4604Z',
          difficulty: 142342602928675.06,
          height: 916819,
          acceptedShares: 29412120985600,
          blockHash: '000000000000000000006872e9f841e9c8163589b01578f8ae03a7405c66afe4',
          datumInfo: { tags: ['< OCEAN.XYZ >', 'Test'], solverName: 'Test' }
        }
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockData
      } as Response);

      const result = await oceanApi.getBlocksFound();

      expect(mockFetch).toHaveBeenCalledWith('https://ocean.xyz/data/json/blocksfound');
      expect(result).toEqual(mockData);
    });

    it('should handle fetch errors gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await oceanApi.getBlocksFound();

      expect(result).toEqual([]);
    });

    it('should handle HTTP errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500
      } as Response);

      const result = await oceanApi.getBlocksFound();

      expect(result).toEqual([]);
    });
  });

  describe('getShareWindow', () => {
    it('should fetch and return share window data', async () => {
      const mockData = {
        date: '2025-09-25T05:30:00Z',
        size: 1138740823429400
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockData
      } as Response);

      const result = await oceanApi.getShareWindow();

      expect(mockFetch).toHaveBeenCalledWith('https://ocean.xyz/data/json/sharewindow');
      expect(result).toEqual(mockData);
    });

    it('should return default data on error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await oceanApi.getShareWindow();

      expect(result.size).toBe(0);
      expect(result.date).toBeTruthy();
    });
  });

  describe('getHashRateData', () => {
    it('should fetch and parse CSV hashrate data', async () => {
      const mockCSV = `2025-08-29T19:30:00Z,,344048.740533
2025-08-29T19:40:00Z,,348942.652128
2025-08-29T19:50:00Z,,356399.862511`;

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => mockCSV
      } as Response);

      const result = await oceanApi.getHashRateData('bc1qtest');

      expect(mockFetch).toHaveBeenCalledWith('https://ocean.xyz/data/csv/hashrates/worker/bc1qtest');
      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({
        timestamp: '2025-08-29T19:30:00Z',
        worker: '',
        hashRate: 344048.740533
      });
    });

    it('should handle invalid CSV data', async () => {
      const mockCSV = 'invalid,csv,data\n,,\n';

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => mockCSV
      } as Response);

      const result = await oceanApi.getHashRateData('bc1qtest');

      expect(result).toEqual([]);
    });

    it('should filter out zero hashrates', async () => {
      const mockCSV = `2025-08-29T19:30:00Z,,344048.740533
2025-08-29T19:40:00Z,,0
2025-08-29T19:50:00Z,,356399.862511`;

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => mockCSV
      } as Response);

      const result = await oceanApi.getHashRateData('bc1qtest');

      expect(result).toHaveLength(2);
      expect(result.every(item => item.hashRate > 0)).toBe(true);
    });
  });

  describe('getAddressStats', () => {
    it('should calculate address stats correctly', async () => {
      const mockBlocks = [
        {
          solverId: 123,
          solverAddress: 'bc1qtest',
          acceptedShares: 1000000,
          time: '2025-09-28T18:55:07.4604Z',
          height: 916819,
          blockHash: 'test',
          datumInfo: { tags: [], solverName: 'Test' }
        }
      ];

      const mockHashRates = [
        { timestamp: '2025-08-29T19:30:00Z', worker: '', hashRate: 100000 },
        { timestamp: '2025-08-29T19:40:00Z', worker: '', hashRate: 200000 }
      ];

      // Mock getBlocksFound
      vi.spyOn(oceanApi, 'getBlocksFound').mockResolvedValue(mockBlocks as any);

      // Mock getHashRateData
      vi.spyOn(oceanApi, 'getHashRateData').mockResolvedValue(mockHashRates);

      const result = await oceanApi.getAddressStats('bc1qtest');

      expect(result.address).toBe('bc1qtest');
      expect(result.totalHashRate).toBe(200000); // Latest hashrate
      expect(result.totalShares).toBe(1000000);
      expect(result.activeWorkers).toBe(1);
      expect(result.workers).toHaveLength(1);
      expect(result.workers[0].workerName).toBe('Main');
    });

    it('should handle addresses with no data', async () => {
      vi.spyOn(oceanApi, 'getBlocksFound').mockResolvedValue([]);
      vi.spyOn(oceanApi, 'getHashRateData').mockResolvedValue([]);

      const result = await oceanApi.getAddressStats('bc1qempty');

      expect(result.address).toBe('bc1qempty');
      expect(result.totalHashRate).toBe(0);
      expect(result.totalShares).toBe(0);
      expect(result.activeWorkers).toBe(0);
      expect(result.workers).toHaveLength(0);
    });
  });

  describe('createSurveyData', () => {
    it('should create comprehensive survey data', async () => {
      const mockBlocks = [{ solverId: 123, solverAddress: 'bc1qtest', acceptedShares: 1000000 }];
      const mockShareWindow = { date: '2025-09-25T05:30:00Z', size: 1138740823429400 };
      const mockHashRates = [{ timestamp: '2025-08-29T19:30:00Z', worker: '', hashRate: 100000 }];

      vi.spyOn(oceanApi, 'getBlocksFound').mockResolvedValue(mockBlocks as any);
      vi.spyOn(oceanApi, 'getShareWindow').mockResolvedValue(mockShareWindow);
      vi.spyOn(oceanApi, 'getHashRateData').mockResolvedValue(mockHashRates);

      const result = await oceanApi.createSurveyData('bc1qtest', 'testpubkey');

      expect(result.address).toBe('bc1qtest');
      expect(result.surveyor).toBe('testpubkey');
      expect(result.blocksFound).toEqual(mockBlocks);
      expect(result.shareWindow).toEqual(mockShareWindow);
      expect(result.hashRateData).toEqual(mockHashRates);
      expect(result.discoveryScore).toBeGreaterThan(0);
      expect(new Date(result.timestamp)).toBeInstanceOf(Date);
    });
  });
});