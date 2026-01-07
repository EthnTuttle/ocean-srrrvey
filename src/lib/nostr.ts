import { generateSecretKey, getPublicKey, finalizeEvent, nip19, SimplePool, Event } from 'nostr-tools';
import type { OceanSurveyData, NostrSurveyNote } from './types';
import { generateSimulatedWorkers, generateSummaryStats } from './worker-simulator';

export class NostrClient {
  private secretKey: Uint8Array;
  private publicKey: string;
  private pool: SimplePool;
  private relays = [
    'wss://relay.damus.io',
    'wss://nos.lol',
    'wss://relay.nostr.band',
    'wss://nostr-pub.wellorder.net'
  ];

  constructor(existingSecretKey?: Uint8Array) {
    this.secretKey = existingSecretKey || generateSecretKey();
    this.publicKey = getPublicKey(this.secretKey);
    this.pool = new SimplePool();

    // Set profile on initialization (but don't wait for it)
    setTimeout(() => this.setProfile(), 1000);
  }

  private async setProfile(): Promise<void> {
    try {
      const profileEvent = {
        kind: 0,
        pubkey: this.publicKey,
        created_at: Math.floor(Date.now() / 1000),
        tags: [],
        content: JSON.stringify({
          name: "🏴‍☠️  Telehash Pirate 🏴‍☠️",
          about: "Telehash mining pool surveyor and data pirate",
          picture: "https://telehashpirate.com/pirate-ocean.svg",
          website: "https://telehashpirate.com"
        })
      };

      const signedProfileEvent = finalizeEvent(profileEvent, this.secretKey);
      const results = await Promise.allSettled(
        this.relays.map(relay => this.pool.publish([relay], signedProfileEvent))
      );

      const successful = results.filter(r => r.status === 'fulfilled').length;
      console.log(`Profile published to ${successful}/${this.relays.length} relays`);

    } catch (error) {
      console.error('Failed to set profile:', error);
    }
  }

  getPublicKey(): string {
    return this.publicKey;
  }

  getNpub(): string {
    return nip19.npubEncode(this.publicKey);
  }

  getSecretKey(): Uint8Array {
    return this.secretKey;
  }

  async publishSurveyNote(oceanData: OceanSurveyData): Promise<string> {
    const content = this.formatSurveyContent(oceanData);

    const unsignedEvent = {
      kind: 1,
      pubkey: this.publicKey,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['t', 'telehash-pirate'],
        ['address', oceanData.address],
        ['timestamp', oceanData.timestamp],
        ['discovery-score', oceanData.discoveryScore.toString()]
      ],
      content
    };

    const signedEvent = finalizeEvent(unsignedEvent, this.secretKey);

    const publishedToRelays = await Promise.allSettled(
      this.relays.map(relay => this.pool.publish([relay], signedEvent))
    );

    // Log only successful publications
    const successful = publishedToRelays.filter(result => result.status === 'fulfilled');
    console.log(`Published to ${successful.length}/${this.relays.length} relays successfully`);

    return signedEvent.id;
  }

  private formatSurveyContent(oceanData: OceanSurveyData): string {
    const currentHashRate = oceanData.hashRateData.length > 0
      ? oceanData.hashRateData[oceanData.hashRateData.length - 1].hashRate
      : 0;

    const addressBlocks = oceanData.blocksFound.filter(block =>
      block.solverAddress === oceanData.address
    );

    // Generate workers for this address
    const workers = generateSimulatedWorkers(oceanData.address, currentHashRate);
    const topWorkers = workers.slice(0, 21); // Top 21 workers
    const summary = generateSummaryStats(workers);

    // Format top workers for display
    const workerList = topWorkers.slice(0, 5).map((worker, idx) =>
      `${idx + 1}. ${worker.workerName}: ${(worker.hashRate60s).toFixed(1)} TH/s`
    ).join('\n');

    const moreWorkersText = topWorkers.length > 5
      ? `\n...and ${topWorkers.length - 5} more pirates in the crew`
      : '';

    return `🏴‍☠️ Telehash Pirate Fleet Report 🌊

📍 Address: ${oceanData.address.slice(0, 20)}...${oceanData.address.slice(-8)}
⚡ Fleet Power: ${currentHashRate.toFixed(1)} TH/s
👥 Active Crew: ${summary.activeWorkers}/${summary.totalWorkers} pirates
🎯 Discovery Score: ${oceanData.discoveryScore}
📊 Efficiency: ${summary.efficiency.toFixed(1)}%

⚔️ Top Performers:
${workerList}${moreWorkersText}

⛏️ Address Blocks: ${addressBlocks.length}
📊 Share Window: ${(oceanData.shareWindow.size / 1e12).toFixed(1)}T
🕐 Survey: ${new Date(oceanData.timestamp).toLocaleString()}

#telehash-pirate #bitcoin #mining ${oceanData.address.slice(-8)}`;
  }

  async fetchSurveyNotes(limit = 50): Promise<NostrSurveyNote[]> {
    return new Promise((resolve) => {
      const notes: NostrSurveyNote[] = [];

      const sub = this.pool.subscribeMany(this.relays, [{
        kinds: [1],
        '#t': ['telehash-pirate'],
        limit
      }], {
        onevent(event: Event) {
          try {
            const oceanData = JSON.parse(event.content.split('\\n\\n')[1] || '{}');
            const discoveryScoreTag = event.tags.find(tag => tag[0] === 'discovery-score');
            const discoveryScore = discoveryScoreTag ? parseFloat(discoveryScoreTag[1]) : 0;

            notes.push({
              ...event,
              oceanData,
              discoveryScore
            } as NostrSurveyNote);
          } catch (error) {
            console.error('Error parsing survey note:', error);
          }
        },
        oneose() {
          sub.close();
          resolve(notes.sort((a, b) => b.created_at - a.created_at));
        }
      });

      // Timeout after 5 seconds
      setTimeout(() => {
        sub.close();
        resolve(notes.sort((a, b) => b.created_at - a.created_at));
      }, 5000);
    });
  }

  disconnect() {
    this.pool.close(this.relays);
  }
}