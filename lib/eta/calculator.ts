/**
 * Dynamic ETA Calculator
 *
 * Computes estimated wait time (in minutes) based on:
 * - Current position ahead in queue (number of waiting people before this token)
 * - Average service time per token in minutes (queue-configured)
 * - Number of active (non-paused, available/busy) counters serving the queue
 */
export function calculateEstimatedWaitTime(params: {
  position: number; // 1-based position (1 = next up)
  estimatedServiceTimeMins: number; // default service time per ticket (e.g. 5 mins)
  activeCounterCount: number; // number of operating counters (>= 1)
}): number {
  const { position, estimatedServiceTimeMins, activeCounterCount } = params;

  if (position <= 0) return 0;
  if (position === 1) {
    // Next up: immediate or very short wait (~1-2 mins)
    return Math.max(1, Math.round(estimatedServiceTimeMins * 0.4));
  }

  // Active serving throughput
  const effectiveCounters = Math.max(1, activeCounterCount);
  const peopleAhead = position - 1;

  // Formula: (peopleAhead / effectiveCounters) * avgServiceTime
  const rawWait = (peopleAhead / effectiveCounters) * estimatedServiceTimeMins;
  return Math.max(1, Math.round(rawWait));
}
