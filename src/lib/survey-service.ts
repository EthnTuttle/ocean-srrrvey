import { NostrClient } from './nostr';
import { OceanAPI } from './ocean-api';
import type { OceanSurveyData, NostrSurveyNote } from './types';

export class SurveyService {
  private nostrClient: NostrClient;
  private oceanApi: OceanAPI;
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor(existingSecretKey?: Uint8Array) {
    // Try to load existing key from sessionStorage first (persists during browsing session)
    let secretKey = existingSecretKey;

    if (!secretKey && typeof window !== 'undefined') {
      const storedKey = sessionStorage.getItem('ocean-survey-key');
      if (storedKey) {
        try {
          const keyArray = JSON.parse(storedKey);
          secretKey = new Uint8Array(keyArray);
        } catch (error) {
          console.error('Failed to parse stored key:', error);
        }
      }
    }

    this.nostrClient = new NostrClient(secretKey);
    this.oceanApi = new OceanAPI();

    // Store the key for the session
    if (typeof window !== 'undefined') {
      const keyArray = Array.from(this.nostrClient.getSecretKey());
      sessionStorage.setItem('ocean-survey-key', JSON.stringify(keyArray));
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

    return results.sort((a, b) => {
      // Sort by match type first (same address first), then by score
      if (a.matchType !== b.matchType) {
        return a.matchType === 'same-address' ? -1 : 1;
      }
      return b.matchScore - a.matchScore;
    });
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

    const scoreDiff = Math.abs(myScore - otherScore);
    const scoreDeviation = scoreDiff / Math.max(myScore, otherScore, 1);

    if (timeDiffMinutes < 5) {
      if (scoreDeviation < 0.1) {
        return `Concurrent survey ${timeDiffMinutes}m ago shows identical results (±${scoreDiff.toFixed(1)} score)`;
      } else {
        return `Concurrent survey ${timeDiffMinutes}m ago shows different results (${scoreDiff.toFixed(1)} score difference)`;
      }
    } else if (timeDiffMinutes < 30) {
      if (scoreDeviation < 0.2) {
        return `Recent survey ${timeDiffMinutes}m ago confirms similar mining activity`;
      } else {
        return `Recent survey ${timeDiffMinutes}m ago shows mining activity changed`;
      }
    } else {
      return `Earlier survey ${timeDiffMinutes}m ago for comparison`;
    }
  }

  private analyzeCrossAddressSurvey(
    mySurvey: OceanSurveyData,
    otherSurvey: NostrSurveyNote,
    otherAddress: string
  ): string {
    const myScore = mySurvey.discoveryScore;
    const otherScore = otherSurvey.discoveryScore || 0;

    if (otherScore > myScore * 1.5) {
      return `Address ${otherAddress.slice(-8)} shows higher mining activity (${otherScore.toFixed(1)} vs ${myScore.toFixed(1)})`;
    } else if (otherScore < myScore * 0.7) {
      return `Address ${otherAddress.slice(-8)} shows lower mining activity (${otherScore.toFixed(1)} vs ${myScore.toFixed(1)})`;
    } else {
      return `Address ${otherAddress.slice(-8)} shows similar mining activity (${otherScore.toFixed(1)} vs ${myScore.toFixed(1)})`;
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