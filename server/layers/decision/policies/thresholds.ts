export const THRESHOLDS = {
  EXECUTE_THRESHOLD: 0.75,
  ASK_THRESHOLD: 0.45,
  STOP_THRESHOLD: 0.25,
  HIGH_COGNITIVE_LOAD_MODIFIER: -0.15,
  FOLLOW_UP_CONFIDENCE_BOOST: 0.1
} as const;

export function shouldExecute(confidence: number, cognitiveLoad: string): boolean {
  const adjusted = cognitiveLoad === 'high' 
    ? confidence + THRESHOLDS.HIGH_COGNITIVE_LOAD_MODIFIER 
    : confidence;
  return adjusted >= THRESHOLDS.EXECUTE_THRESHOLD;
}

export function shouldAsk(confidence: number): boolean {
  return confidence >= THRESHOLDS.ASK_THRESHOLD && confidence < THRESHOLDS.EXECUTE_THRESHOLD;
}

export function shouldStop(confidence: number): boolean {
  return confidence < THRESHOLDS.STOP_THRESHOLD;
}

export function adjustConfidenceForFollowUp(confidence: number, isFollowUp: boolean): number {
  return isFollowUp ? confidence + THRESHOLDS.FOLLOW_UP_CONFIDENCE_BOOST : confidence;
}
