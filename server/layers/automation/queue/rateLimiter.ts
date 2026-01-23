// Layer 6: Automation Layer - Rate Limiter

import type { ProviderType } from '../types/automationTypes.js';

interface RateLimitConfig {
  maxPerMinute: number;
}

interface RateLimitState {
  requests: number[];
}

const RATE_LIMITS: Record<ProviderType, RateLimitConfig> = {
  mock: { maxPerMinute: 100 },
  google_calendar: { maxPerMinute: 30 }
};

const rateLimitState: Record<ProviderType, RateLimitState> = {
  mock: { requests: [] },
  google_calendar: { requests: [] }
};

function cleanOldRequests(provider: ProviderType): void {
  const now = Date.now();
  const oneMinuteAgo = now - 60000;
  rateLimitState[provider].requests = rateLimitState[provider].requests.filter(
    ts => ts > oneMinuteAgo
  );
}

export function canMakeRequest(provider: ProviderType): boolean {
  cleanOldRequests(provider);
  const config = RATE_LIMITS[provider];
  return rateLimitState[provider].requests.length < config.maxPerMinute;
}

export function recordRequest(provider: ProviderType): void {
  cleanOldRequests(provider);
  rateLimitState[provider].requests.push(Date.now());
}

export function getWaitTimeMs(provider: ProviderType): number {
  cleanOldRequests(provider);
  const state = rateLimitState[provider];
  const config = RATE_LIMITS[provider];
  
  if (state.requests.length < config.maxPerMinute) {
    return 0;
  }
  
  const oldestRequest = Math.min(...state.requests);
  const waitUntil = oldestRequest + 60000;
  return Math.max(0, waitUntil - Date.now());
}

export function resetRateLimiter(): void {
  rateLimitState.mock = { requests: [] };
  rateLimitState.google_calendar = { requests: [] };
}
