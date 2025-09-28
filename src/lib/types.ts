export interface BlockFoundData {
  solverId: number;
  solverAddress: string;
  time: string;
  difficulty: number;
  height: number;
  acceptedShares: number;
  shareWindowSize: number;
  blockHash: string;
  workerName: string;
  coinbaseTxHex: string | null;
  datumInfo: {
    tags: string[];
    solverName: string;
  };
  subsidy: number;
  txnFees: number;
  userEarningsComplete: boolean;
  legacy: boolean;
  graphTime: string;
}

export interface ShareWindowData {
  date: string;
  size: number;
}

export interface HashRateData {
  timestamp: string;
  worker: string;
  hashRate: number;
}

export interface WorkerStats {
  workerName: string;
  hashRate60s: number;
  hashRate3hr: number;
  hashRate24hr: number;
  lastSeen: string;
  shares: number;
  earnings: number;
}

export interface AddressStats {
  address: string;
  totalHashRate: number;
  totalShares: number;
  totalEarnings: number;
  activeWorkers: number;
  workers: WorkerStats[];
  lastUpdate: string;
}

export interface OceanSurveyData {
  address: string;
  timestamp: string;
  blocksFound: BlockFoundData[];
  shareWindow: ShareWindowData;
  hashRateData: HashRateData[];
  discoveryScore: number;
  surveyor: string; // Nostr public key
}

export interface NostrSurveyNote {
  id: string;
  pubkey: string;
  created_at: number;
  kind: number;
  tags: string[][];
  content: string;
  sig: string;
  oceanData: OceanSurveyData;
  discoveryScore: number;
}