import { NostrClient } from './nostr';
import { OceanAPI } from './ocean-api';
import { CookieManager } from './cookies';
import type { OceanSurveyData, NostrSurveyNote } from './types';

export class SurveyService {
  private nostrClient: NostrClient;
  private oceanApi: OceanAPI;
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor(existingSecretKey?: Uint8Array) {
    // Try to load existing key from cookies first (persists across sessions)
    let secretKey = existingSecretKey;

    if (!secretKey) {
      secretKey = CookieManager.getTelehashPirateKey();
    }

    this.nostrClient = new NostrClient(secretKey);
    this.oceanApi = new OceanAPI();

    // Store the key in cookies (only if cookies are accepted)
    if (typeof window !== 'undefined' && CookieManager.getCookie('telehash-pirate-consent') === 'accepted') {
      CookieManager.setTelehashPirateKey(this.nostrClient.getSecretKey());
    }
  }

  // Method to store key after cookie consent
  storePirateKey(): void {
    if (typeof window !== 'undefined') {
      CookieManager.setTelehashPirateKey(this.nostrClient.getSecretKey());
    }
  }

  getNostrClient(): NostrClient {
    return this.nostrClient;
  }

  async performSurvey(address: string): Promise<OceanSurveyData> {
    console.log(`Performing survey for address: ${address}`);

    const surveyData = await this.oceanApi.createSurveyData(
      address,
      this.nostrClient.getPublicKey()
    );

    // Post to Nostr
    try {
      const noteId = await this.nostrClient.publishSurveyNote(surveyData);
      console.log(`Survey posted to Nostr with ID: ${noteId}`);
    } catch (error) {
      console.error('Failed to post survey to Nostr:', error);
    }

    return surveyData;
  }

  async fetchRecentSurveys(): Promise<NostrSurveyNote[]> {
    return this.nostrClient.fetchSurveyNotes(50);
  }

  compareWithOtherSurveys(
    mySurvey: OceanSurveyData,
    otherSurveys: NostrSurveyNote[]
  ): Array<{ survey: NostrSurveyNote; matchScore: number; isRecent: boolean; matchType: string; analysis: string }> {
    const results: Array<{ survey: NostrSurveyNote; matchScore: number; isRecent: boolean; matchType: string; analysis: string }> = [];
    const surveyTime = new Date(mySurvey.timestamp);

    // Group surveys by address
    const addressGroups = new Map<string, NostrSurveyNote[]>();

    for (const otherSurvey of otherSurveys) {
      if (otherSurvey.pubkey === this.nostrClient.getPublicKey()) {
        continue; // Skip our own surveys
      }

      // Extract address from tags or content
      const address = this.extractAddressFromSurvey(otherSurvey);
      if (!address) continue;

      if (!addressGroups.has(address)) {
        addressGroups.set(address, []);
      }
      addressGroups.get(address)!.push(otherSurvey);
    }

    // Analyze surveys for the same address
    const sameAddressSurveys = addressGroups.get(mySurvey.address) || [];
    for (const otherSurvey of sameAddressSurveys) {
      const otherSurveyTime = new Date(otherSurvey.created_at * 1000);
      const timeDiff = Math.abs(surveyTime.getTime() - otherSurveyTime.getTime());
      const isRecent = timeDiff < 30 * 60 * 1000; // Within 30 minutes for same address

      const analysis = this.analyzeSameAddressSurvey(mySurvey, otherSurvey, timeDiff);

      results.push({
        survey: otherSurvey,
        matchScore: 1.0, // Perfect match for same address
        isRecent,
        matchType: 'same-address',
        analysis
      });
    }

    // Analyze surveys for different addresses with similar characteristics
    for (const [address, surveys] of addressGroups.entries()) {
      if (address === mySurvey.address) continue; // Already handled above

      const latestSurvey = surveys.sort((a, b) => b.created_at - a.created_at)[0];
      const otherSurveyTime = new Date(latestSurvey.created_at * 1000);
      const timeDiff = Math.abs(surveyTime.getTime() - otherSurveyTime.getTime());
      const isRecent = timeDiff < 60 * 60 * 1000; // Within 1 hour for different addresses

      if (!isRecent) continue;

      const matchScore = this.calculateCrossAddressMatch(mySurvey, latestSurvey);
      if (matchScore > 0.3) { // Lower threshold for cross-address matches
        const analysis = this.analyzeCrossAddressSurvey(mySurvey, latestSurvey, address);

        results.push({
          survey: latestSurvey,
          matchScore,
          isRecent,
          matchType: 'cross-address',
          analysis
        });
      }
    }

    const sortedResults = results.sort((a, b) => {
      // Sort by match type first (same address first), then by score
      if (a.matchType !== b.matchType) {
        return a.matchType === 'same-address' ? -1 : 1;
      }
      return b.matchScore - a.matchScore;
    });

    // Add network trend analysis as the first item if we have cross-address matches
    const crossAddressMatches = sortedResults.filter(r => r.matchType === 'cross-address');
    if (crossAddressMatches.length > 0) {
      const networkTrend = this.analyzeNetworkTrend(mySurvey, crossAddressMatches);
      if (networkTrend) {
        sortedResults.unshift(networkTrend);
      }
    }

    return sortedResults;
  }

  private analyzeNetworkTrend(
    mySurvey: OceanSurveyData,
    crossAddressMatches: Array<{ survey: NostrSurveyNote; matchScore: number; isRecent: boolean; matchType: string; analysis: string }>
  ): { survey: NostrSurveyNote; matchScore: number; isRecent: boolean; matchType: string; analysis: string } | null {
    if (crossAddressMatches.length < 2) return null;

    const myScore = mySurvey.discoveryScore;
    const otherScores = crossAddressMatches.map(m => m.survey.discoveryScore || 0).filter(s => s > 0);

    if (otherScores.length === 0) return null;

    const avgOtherScore = otherScores.reduce((a, b) => a + b, 0) / otherScores.length;
    const myRank = otherScores.filter(s => s < myScore).length + 1;
    const totalAddresses = otherScores.length + 1;
    const percentile = Math.round(((totalAddresses - myRank) / totalAddresses) * 100);

    const trend = myScore > avgOtherScore * 1.2 ? 'above average' :
                  myScore < avgOtherScore * 0.8 ? 'below average' : 'average';

    const analysis = `Network overview: Your mining ranks ${myRank}/${totalAddresses} (${percentile}th percentile) - performance ${trend} vs community average ${avgOtherScore.toFixed(1)}`;

    return {
      survey: crossAddressMatches[0].survey, // Use first survey as placeholder
      matchScore: 1.0,
      isRecent: true,
      matchType: 'network-trend',
      analysis
    };
  }

  private calculateMatchScore(
    mySurvey: OceanSurveyData,
    otherSurvey: NostrSurveyNote
  ): number {
    let score = 0;
    let maxScore = 0;

    // Compare block heights (most recent blocks should match)
    maxScore += 40;
    const myRecentBlocks = mySurvey.blocksFound.slice(0, 10).map(b => b.height);
    const otherRecentBlocks = otherSurvey.oceanData?.blocksFound?.slice(0, 10)?.map(b => b.height) || [];

    const blockMatches = myRecentBlocks.filter(height =>
      otherRecentBlocks.includes(height)
    ).length;
    score += (blockMatches / Math.max(1, Math.min(myRecentBlocks.length, otherRecentBlocks.length))) * 40;

    // Compare discovery scores (should be similar)
    maxScore += 30;
    const scoreDiff = Math.abs(mySurvey.discoveryScore - (otherSurvey.discoveryScore || 0));
    const maxExpectedScore = Math.max(mySurvey.discoveryScore, otherSurvey.discoveryScore || 0);
    if (maxExpectedScore > 0) {
      score += Math.max(0, (1 - scoreDiff / maxExpectedScore)) * 30;
    }

    // Compare share window size
    maxScore += 20;
    const myShareSize = mySurvey.shareWindow.size;
    const otherShareSize = otherSurvey.oceanData?.shareWindow?.size || 0;
    if (myShareSize > 0 && otherShareSize > 0) {
      const sizeDiff = Math.abs(myShareSize - otherShareSize);
      const maxSize = Math.max(myShareSize, otherShareSize);
      score += Math.max(0, (1 - sizeDiff / maxSize)) * 20;
    }

    // Survey timing proximity
    maxScore += 10;
    const myTime = new Date(mySurvey.timestamp).getTime();
    const otherTime = otherSurvey.created_at * 1000;
    const timeDiff = Math.abs(myTime - otherTime);
    const maxTimeDiff = 5 * 60 * 1000; // 5 minutes
    score += Math.max(0, (1 - timeDiff / maxTimeDiff)) * 10;

    return maxScore > 0 ? score / maxScore : 0;
  }

  private extractAddressFromSurvey(survey: NostrSurveyNote): string | null {
    // First try to get address from tags
    const addressTag = survey.tags.find(tag => tag[0] === 'address');
    if (addressTag && addressTag[1]) {
      return addressTag[1];
    }

    // Try to extract from content using regex
    const addressRegex = /📍\s*Address:\s*([a-zA-Z0-9]{20,})/;
    const match = survey.content.match(addressRegex);
    if (match) {
      // This is just the prefix, try to find full address from hashtag
      const hashtagRegex = /#([a-zA-Z0-9]{8,})\s*$/;
      const hashMatch = survey.content.match(hashtagRegex);
      if (hashMatch && hashMatch[1].length >= 8) {
        // This is the suffix, we need to reconstruct or find another way
        // For now, return the suffix as identifier
        return hashMatch[1];
      }
    }

    return null;
  }

  private analyzeSameAddressSurvey(
    mySurvey: OceanSurveyData,
    otherSurvey: NostrSurveyNote,
    timeDiffMs: number
  ): string {
    const timeDiffMinutes = Math.floor(timeDiffMs / (1000 * 60));
    const myScore = mySurvey.discoveryScore;
    const otherScore = otherSurvey.discoveryScore || 0;

    const scoreDiff = myScore - otherScore;
    const scoreDeviation = Math.abs(scoreDiff) / Math.max(myScore, otherScore, 1);

    // Show temporal delta with direction
    const deltaDirection = scoreDiff > 0 ? 'increased' : scoreDiff < 0 ? 'decreased' : 'unchanged';
    const deltaAmount = Math.abs(scoreDiff).toFixed(1);

    if (timeDiffMinutes < 5) {
      if (scoreDeviation < 0.1) {
        return `Real-time: Activity stable (${deltaDirection} ${deltaAmount} score in ${timeDiffMinutes}m)`;
      } else {
        return `Real-time: Activity ${deltaDirection} by ${deltaAmount} score in ${timeDiffMinutes}m`;
      }
    } else if (timeDiffMinutes < 30) {
      const trend = scoreDiff > 5 ? 'ramping up' : scoreDiff < -5 ? 'slowing down' : 'steady';
      return `${timeDiffMinutes}m delta: Mining ${trend} (${deltaDirection} ${deltaAmount} score)`;
    } else if (timeDiffMinutes < 120) {
      const hours = (timeDiffMinutes / 60).toFixed(1);
      return `${hours}h delta: Activity ${deltaDirection} by ${deltaAmount} score since then`;
    } else {
      const hours = Math.floor(timeDiffMinutes / 60);
      return `Historical: ${hours}h ago showed ${otherScore.toFixed(1)} score (now ${myScore.toFixed(1)})`;
    }
  }

  private analyzeCrossAddressSurvey(
    mySurvey: OceanSurveyData,
    otherSurvey: NostrSurveyNote,
    otherAddress: string
  ): string {
    const myScore = mySurvey.discoveryScore;
    const otherScore = otherSurvey.discoveryScore || 0;
    const timeDiffMinutes = Math.floor(Math.abs(new Date(mySurvey.timestamp).getTime() - (otherSurvey.created_at * 1000)) / (1000 * 60));

    const ratio = myScore > 0 ? otherScore / myScore : 0;
    const percentDiff = Math.abs((ratio - 1) * 100).toFixed(0);

    if (otherScore > myScore * 1.5) {
      return `Network trend: ${otherAddress.slice(-8)} outperforming by ${percentDiff}% (${otherScore.toFixed(1)} vs ${myScore.toFixed(1)}) ${timeDiffMinutes}m ago`;
    } else if (otherScore < myScore * 0.7) {
      return `Network trend: Your address outperforming ${otherAddress.slice(-8)} by ${percentDiff}% (${myScore.toFixed(1)} vs ${otherScore.toFixed(1)}) now vs ${timeDiffMinutes}m ago`;
    } else {
      return `Network peer: ${otherAddress.slice(-8)} similar performance (${otherScore.toFixed(1)} vs ${myScore.toFixed(1)}, ±${percentDiff}%)`;
    }
  }

  private calculateCrossAddressMatch(
    mySurvey: OceanSurveyData,
    otherSurvey: NostrSurveyNote
  ): number {
    let score = 0;
    let maxScore = 0;

    // Base score for being active around the same time
    maxScore += 30;
    score += 30;

    // Compare discovery scores (similar activity levels)
    maxScore += 40;
    const myScore = mySurvey.discoveryScore;
    const otherScore = otherSurvey.discoveryScore || 0;
    if (myScore > 0 && otherScore > 0) {
      const scoreSimilarity = 1 - Math.abs(myScore - otherScore) / Math.max(myScore, otherScore);
      score += scoreSimilarity * 40;
    }

    // Pool data consistency (they should see similar pool state)
    maxScore += 30;
    // This is a simplified check - in practice we'd compare block data
    score += 20; // Assume some consistency

    return maxScore > 0 ? score / maxScore : 0;
  }

  startPeriodicSurvey(address: string, intervalMinutes = 1): void {
    if (this.isRunning) {
      console.log('Survey already running');
      return;
    }

    console.log(`Starting periodic survey for ${address} every ${intervalMinutes} minutes`);
    this.isRunning = true;

    // Perform initial survey
    this.performSurvey(address);

    // Set up periodic survey
    this.intervalId = setInterval(() => {
      this.performSurvey(address);
    }, intervalMinutes * 60 * 1000);
  }

  stopPeriodicSurvey(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log('Periodic survey stopped');
  }

  isActive(): boolean {
    return this.isRunning;
  }

  disconnect(): void {
    this.stopPeriodicSurvey();
    this.nostrClient.disconnect();
  }
}