import { generateSecretKey, getPublicKey, finalizeEvent, nip19, SimplePool, Event } from 'nostr-tools';
import type { OceanSurveyData, NostrSurveyNote } from './types';

export class NostrClient {
  private secretKey: Uint8Array;
  private publicKey: string;
  private pool: SimplePool;
  private relays = [
    'wss://relay.damus.io',
    'wss://nos.lol',
    'wss://relay.nostr.band',
    'wss://nostr.wine'
  ];

  constructor(existingSecretKey?: Uint8Array) {
    this.secretKey = existingSecretKey || generateSecretKey();
    this.publicKey = getPublicKey(this.secretKey);
    this.pool = new SimplePool();

    // Set profile on initialization
    this.setProfile();
  }

  private async setProfile(): Promise<void> {
    try {
      const profileEvent = {
        kind: 0,
        pubkey: this.publicKey,
        created_at: Math.floor(Date.now() / 1000),
        tags: [],
        content: JSON.stringify({
          name: "🏴‍☠️  pirating the Ocean 🏴‍☠️",
          about: "Ocean mining pool surveyor and data pirate",
          picture: "https://i.nostr.build/ocean-pirate.jpg"
        })
      };

      const signedProfileEvent = finalizeEvent(profileEvent, this.secretKey);
      await Promise.allSettled(
        this.relays.map(relay => this.pool.publish([relay], signedProfileEvent))
      );
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
        ['t', 'ocean-srrrvey'],
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

    console.log('Published to relays:', publishedToRelays);
    return signedEvent.id;
  }

  private formatSurveyContent(oceanData: OceanSurveyData): string {
    const recentBlocks = oceanData.blocksFound.slice(0, 5);
    const blockSummary = recentBlocks.map(block =>
      `Block ${block.height}: ${block.datumInfo.solverName} (${block.acceptedShares} shares)`
    ).join('\\n');

    return `Ocean Mining Survey 🌊⛏️

Address: ${oceanData.address}
Survey Time: ${new Date(oceanData.timestamp).toISOString()}
Discovery Score: ${oceanData.discoveryScore}

Recent Blocks Found:
${blockSummary}

Share Window: ${oceanData.shareWindow.size.toLocaleString()} shares
Hash Rate Samples: ${oceanData.hashRateData.length}

#ocean-srrrvey #bitcoin #mining`;
  }

  async fetchSurveyNotes(limit = 50): Promise<NostrSurveyNote[]> {
    return new Promise((resolve) => {
      const notes: NostrSurveyNote[] = [];

      const sub = this.pool.subscribeMany(this.relays, [{
        kinds: [1],
        '#t': ['ocean-srrrvey'],
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