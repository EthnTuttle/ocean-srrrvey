# Ocean Srrrvey 🌊⛏️

A Bitcoin mining pool monitoring bot that queries Ocean.xyz API data and shares findings on Nostr.

## Features

- **Automatic Key Generation**: Creates a new Nostr keypair each time the page loads
- **Ocean API Monitoring**: Queries Ocean.xyz for blocks found, share windows, and hashrate data
- **Nostr Publishing**: Posts survey results to Nostr with `#ocean-srrrvey` hashtag
- **Community Comparison**: Compares your findings with other surveyors
- **Discovery Score**: Weighted algorithm that scores data completeness and activity
- **Auto-Reload**: Page reloads every minute for continuous monitoring

## How It Works

1. **Page Load**: Generates new Nostr identity and starts surveying
2. **Data Collection**: Fetches data from Ocean.xyz API endpoints:
   - `/data/json/blocksfound` - Recent blocks found
   - `/data/json/sharewindow` - Current share window size
   - `/data/csv/hashrates/worker/{address}` - Hashrate data for monitored address

3. **Discovery Scoring**: Calculates a score based on:
   - Recent blocks found by the monitored address
   - Hashrate consistency and magnitude
   - Share window participation
   - General network activity

4. **Nostr Publishing**: Posts formatted survey data to multiple Nostr relays
5. **Community Comparison**: Fetches other `#ocean-srrrvey` notes and compares findings
6. **Match Detection**: Shows surveys from others with similar results

## Target Address

Currently monitoring: `bc1q6f3ged3f74sga3z2cgeyehv5f9lu9r6p5arqvf44yzsy4gtjxtlsmnhn8j`

## Match Algorithm

Surveys are compared on:
- **Block Heights** (40%): Recent blocks should match across surveyors
- **Discovery Scores** (30%): Similar activity should yield similar scores
- **Share Window Size** (20%): Network-wide data should be consistent
- **Survey Timing** (10%): Surveys taken around the same time

## Nostr Integration

- Uses multiple public Nostr relays for redundancy
- Posts include structured data and human-readable summaries
- Tagged with `#ocean-srrrvey` for easy filtering
- Includes discovery score and surveyor identity

## Usage

1. Open the web interface
2. System automatically starts surveying
3. View your discovery score and recent blocks
4. Check community findings for matching results
5. Page reloads automatically after 1 minute

## Technical Details

Built with:
- React + TypeScript + Vite
- nostr-tools for Nostr integration
- TailwindCSS for styling
- Ocean.xyz public API

The system is designed to be ephemeral - each page load creates a new identity and performs a fresh survey, making it ideal for decentralized monitoring without persistent storage requirements.