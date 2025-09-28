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
  ): Array<{ survey: NostrSurveyNote; matchScore: number; isRecent: boolean }> {
    const results: Array<{ survey: NostrSurveyNote; matchScore: number; isRecent: boolean }> = [];
    const surveyTime = new Date(mySurvey.timestamp);

    for (const otherSurvey of otherSurveys) {
      if (otherSurvey.pubkey === this.nostrClient.getPublicKey()) {
        continue; // Skip our own surveys
      }

      const otherSurveyTime = new Date(otherSurvey.created_at * 1000);
      const timeDiff = Math.abs(surveyTime.getTime() - otherSurveyTime.getTime());
      const isRecent = timeDiff < 5 * 60 * 1000; // Within 5 minutes

      if (!isRecent) continue;

      const matchScore = this.calculateMatchScore(mySurvey, otherSurvey);
      if (matchScore > 0.5) { // Only include surveys with >50% match
        results.push({
          survey: otherSurvey,
          matchScore,
          isRecent
        });
      }
    }

    return results.sort((a, b) => b.matchScore - a.matchScore);
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