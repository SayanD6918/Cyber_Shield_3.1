import type { Decision } from "./types";

export type RiskInputs = {
  ocrConfidence: number;
  expiryStatus: "valid" | "expired" | "unknown";
  tamperStatus: "passed" | "review" | "fail" | "unknown";
  faceStatus: "passed" | "review" | "fail" | "unknown";
  livenessStatus: "passed" | "review" | "fail" | "unavailable";
  documentTypeKnown: boolean;
  documentNumberPresent: boolean;
  holderNamePresent: boolean;
  nationalityPresent: boolean;
  dobPresent: boolean;
  expiryDatePresent: boolean;
  watchlistHit: boolean;
};

export type RiskResult = {
  score: number;
  decision: Decision;
  reasons: string[];
};

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

export function calculateRisk(inputs: RiskInputs): RiskResult {
  let score = 0;
  const reasons: string[] = [];

  // 1. OCR / extraction quality — maximum 10
  const ocr = clamp(inputs.ocrConfidence);

  if (ocr < 60) {
    score += 10;
    reasons.push("Low OCR confidence");
  } else if (ocr < 85) {
    score += 5;
    reasons.push("Moderate OCR confidence");
  }

  // 2. Expiry — maximum 15
  if (inputs.expiryStatus === "expired") {
    score += 15;
    reasons.push("Document is expired");
  } else if (inputs.expiryStatus === "unknown") {
    score += 7;
    reasons.push("Document expiry could not be confirmed");
  }

  // 3. Tamper analysis — maximum 20
  if (inputs.tamperStatus === "fail") {
    score += 20;
    reasons.push("Possible document tampering detected");
  } else if (inputs.tamperStatus === "review") {
    score += 10;
    reasons.push("Document requires tamper review");
  }

  // 4. Face match — maximum 10
  if (inputs.faceStatus === "fail") {
    score += 10;
    reasons.push("Face comparison failed");
  } else if (inputs.faceStatus === "review") {
    score += 5;
    reasons.push("Face comparison requires review");
  }

  // 5. Liveness — maximum 5
  if (inputs.livenessStatus === "fail") {
    score += 5;
    reasons.push("Liveness check failed");
  }

  // 6. Document type — maximum 10
  if (!inputs.documentTypeKnown) {
    score += 10;
    reasons.push("Document type could not be identified");
  }

  // 7. Required fields — maximum 15
  const missingFields = [
    !inputs.documentNumberPresent,
    !inputs.holderNamePresent,
    !inputs.nationalityPresent,
    !inputs.dobPresent,
    !inputs.expiryDatePresent,
  ].filter(Boolean).length;

  const missingRisk = Math.min(15, missingFields * 3);

  if (missingFields > 0) {
    score += missingRisk;
    reasons.push(`${missingFields} document field(s) could not be confirmed`);
  }

  // 8. Watchlist — maximum 25
  if (inputs.watchlistHit) {
    score += 25;
    reasons.push("Watchlist match detected");
  }

  // Critical indicators should force a HOLD decision.
  const criticalRisk =
    inputs.watchlistHit || inputs.tamperStatus === "fail" || inputs.livenessStatus === "fail";

  if (criticalRisk) {
    score = Math.max(score, 70);
  }

  score = clamp(Math.round(score));

  let decision: Decision;

  if (score >= 70) {
    decision = "hold";
  } else if (score >= 35) {
    decision = "manual";
  } else {
    decision = "safe";
  }

  return {
    score,
    decision,
    reasons,
  };
}
