export type Decision = "safe" | "manual" | "hold";

export type CheckStatus = "passed" | "review" | "fail" | "unavailable";

export type ScanCheck = {
  id: string;
  label: string;
  status: CheckStatus;
  detail: string;
};

export type CaseRecord = {
  id: string;
  createdAt: string;
  documentType: string;
  documentNumber: string;
  holderName: string | null;
  nationality: string | null;
  dateOfBirth: string | null;
  expiryDate: string | null;
  riskScore: number;
  decision: Decision;
  checks: ScanCheck[];
  rationale: string;
  flags: string[];
  fileName: string;
  watchlistHit: boolean;
};

export type WatchlistEntry = {
  id: string;
  name: string;
  reason: string;
  addedAt: string;
};

export type OfficerSettings = {
  officerName: string;
  officerRole: string;
  checkpoint: string;
  autoHoldWatchlist: boolean;
};
