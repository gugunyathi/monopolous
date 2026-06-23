import { randomInt } from 'node:crypto';
import {
  executeArcTransfer,
  listArcAgentWallets,
  listArcPolicies,
  refreshArcExecutionConfirmations,
  type ArcPolicyPatchInput,
} from './arcExecutor.js';
import { ArcExecution } from '../models/ArcExecution.js';
import { getExecutionMultiplier } from '../constants/strategyCatalog.js';

const ARC_AUTONOMY_ENABLED = (process.env.ARC_AUTONOMY_ENABLED ?? 'false').toLowerCase() === 'true';
const ARC_AUTONOMY_INTERVAL_MS = Number(process.env.ARC_AUTONOMY_INTERVAL_MS ?? '60000');
const ARC_AUTONOMY_MAX_ACTIONS_PER_TICK = Number(process.env.ARC_AUTONOMY_MAX_ACTIONS_PER_TICK ?? '2');
const ARC_AUTONOMY_TRANSFER_AMOUNT = Number(process.env.ARC_AUTONOMY_TRANSFER_AMOUNT ?? '1');
const ARC_AUTONOMY_GLOBAL_MAX_USDC_PER_DAY = Number(process.env.ARC_AUTONOMY_GLOBAL_MAX_USDC_PER_DAY ?? '50');
const ARC_AUTONOMY_CIRCUIT_BREAKER_FAILED_TICKS = Number(process.env.ARC_AUTONOMY_CIRCUIT_BREAKER_FAILED_TICKS ?? '5');
const ARC_AUTONOMY_RECIPIENT_REPEAT_LIMIT = Number(process.env.ARC_AUTONOMY_RECIPIENT_REPEAT_LIMIT ?? '5');
const ARC_AUTONOMY_HISTORY_LIMIT = Number(process.env.ARC_AUTONOMY_HISTORY_LIMIT ?? '200');
const ARC_AUTONOMY_DRY_RUN = (process.env.ARC_AUTONOMY_DRY_RUN ?? 'false').toLowerCase() === 'true';
const ARC_AUTONOMY_REQUESTED_BY = 'arc-autonomy-worker';

export interface ArcAutonomyTickSummary {
  tickStartedAt: number;
  tickFinishedAt: number;
  attempted: number;
  submitted: number;
  skipped: number;
  failed: number;
  globalCapUsed: number;
  globalCapLimit: number;
  recipientRepeatStreak: number;
  recipientRepeatAddress?: string;
  confirmationsRefreshed: number;
  confirmed: number;
  pending: number;
  failedConfirmations: number;
  dryRun: boolean;
}

export interface ArcAutonomyTickRecord {
  at: number;
  summary: ArcAutonomyTickSummary;
}

interface ArcPolicyLike {
  agentIndex: number;
  enabled: boolean;
  selectedStrategyId?: string;
  allowlistedToAddresses?: string[];
  maxUsdcPerTx: number;
  maxUsdcPerDay: number;
}

let schedulerTimer: ReturnType<typeof setTimeout> | null = null;
let schedulerRunning = false;
let tickInFlight = false;
let lastTickAt: number | null = null;
let lastSummary: ArcAutonomyTickSummary | null = null;
let consecutiveFailures = 0;
let haltedReason: string | null = null;
let recipientRepeatStreak = 0;
let lastRecipientAddress: string | null = null;
const tickHistory: ArcAutonomyTickRecord[] = [];

function clampPositiveInt(value: number, fallback: number): number {
  if (!Number.isFinite(value) || value <= 0) return fallback;
  return Math.floor(value);
}

function clampPositive(value: number, fallback: number): number {
  if (!Number.isFinite(value) || value <= 0) return fallback;
  return value;
}

function pickRandom<T>(items: T[]): T {
  if (items.length === 1) return items[0];
  return items[randomInt(0, items.length)];
}

async function getGlobalAutonomySpend24h(): Promise<number> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const docs = await ArcExecution.find({
    requestedBy: ARC_AUTONOMY_REQUESTED_BY,
    estimateOnly: false,
    status: { $in: ['submitted', 'confirmed'] },
    createdAt: { $gte: since },
  }).select({ amount: 1 }).lean();

  return docs.reduce((sum, d) => sum + Number(d.amount ?? '0'), 0);
}

function pushTickHistory(summary: ArcAutonomyTickSummary) {
  tickHistory.unshift({ at: Date.now(), summary });
  const limit = clampPositiveInt(ARC_AUTONOMY_HISTORY_LIMIT, 200);
  if (tickHistory.length > limit) {
    tickHistory.length = limit;
  }
}

function haltScheduler(reason: string) {
  haltedReason = reason;
  stopArcAutonomyScheduler();
  console.error(`[ARC Autonomy] Circuit breaker halted scheduler: ${reason}`);
}

function getPolicyForAgent(agentIndex: number, policies: ArcPolicyLike[]): ArcPolicyLike | null {
  return policies.find((p) => p.agentIndex === agentIndex) ?? null;
}

function buildRecipientPool(
  selfAddress: string,
  wallets: Array<{ walletAddress: string }>,
  policy: ArcPolicyLike,
): string[] {
  const candidates = wallets
    .map((w) => w.walletAddress.toLowerCase())
    .filter((addr) => addr !== selfAddress.toLowerCase());

  const allowlist = (policy.allowlistedToAddresses ?? []).map((a) => a.toLowerCase());
  if (allowlist.length === 0) return candidates;

  const allowset = new Set(allowlist);
  return candidates.filter((addr) => allowset.has(addr));
}

function calculateAmount(maxUsdcPerTx: number, strategyId?: string, capUtilization = 0): string {
  const base = clampPositive(ARC_AUTONOMY_TRANSFER_AMOUNT, 1);
  const ceiling = clampPositive(maxUsdcPerTx, 1);
  const strategyMultiplier = getExecutionMultiplier(strategyId);
  const utilizationPenalty = capUtilization >= 0.8 ? 0.75 : 1;
  const amount = Math.min(base * strategyMultiplier * utilizationPenalty, ceiling);
  return amount.toFixed(2);
}

export async function runArcAutonomyTick(): Promise<ArcAutonomyTickSummary> {
  const tickStartedAt = Date.now();

  if (tickInFlight) {
    return {
      tickStartedAt,
      tickFinishedAt: Date.now(),
      attempted: 0,
      submitted: 0,
      skipped: 1,
      failed: 0,
      globalCapUsed: 0,
      globalCapLimit: clampPositive(ARC_AUTONOMY_GLOBAL_MAX_USDC_PER_DAY, 50),
      recipientRepeatStreak,
      recipientRepeatAddress: lastRecipientAddress ?? undefined,
      confirmationsRefreshed: 0,
      confirmed: 0,
      pending: 0,
      failedConfirmations: 0,
      dryRun: ARC_AUTONOMY_DRY_RUN,
    };
  }

  tickInFlight = true;

  const summary: ArcAutonomyTickSummary = {
    tickStartedAt,
    tickFinishedAt: tickStartedAt,
    attempted: 0,
    submitted: 0,
    skipped: 0,
    failed: 0,
    globalCapUsed: 0,
    globalCapLimit: clampPositive(ARC_AUTONOMY_GLOBAL_MAX_USDC_PER_DAY, 50),
    recipientRepeatStreak,
    recipientRepeatAddress: lastRecipientAddress ?? undefined,
    confirmationsRefreshed: 0,
    confirmed: 0,
    pending: 0,
    failedConfirmations: 0,
    dryRun: ARC_AUTONOMY_DRY_RUN,
  };

  try {
    if (haltedReason) {
      summary.skipped++;
      summary.tickFinishedAt = Date.now();
      pushTickHistory(summary);
      lastTickAt = Date.now();
      lastSummary = summary;
      return summary;
    }

    const [wallets, policies] = await Promise.all([listArcAgentWallets(), listArcPolicies()]);
    const enabledPolicies = (policies as ArcPolicyLike[]).filter((p) => p.enabled);
    const maxActions = clampPositiveInt(ARC_AUTONOMY_MAX_ACTIONS_PER_TICK, 2);
    const globalCapLimit = clampPositive(ARC_AUTONOMY_GLOBAL_MAX_USDC_PER_DAY, 50);
    let globalUsed = await getGlobalAutonomySpend24h();
    summary.globalCapUsed = globalUsed;
    summary.globalCapLimit = globalCapLimit;

    const eligibleWallets = wallets.filter((w) => getPolicyForAgent(w.agentIndex, enabledPolicies));

    for (const wallet of eligibleWallets.slice(0, maxActions)) {
      const policy = getPolicyForAgent(wallet.agentIndex, enabledPolicies);
      if (!policy) {
        summary.skipped++;
        continue;
      }

      const recipients = buildRecipientPool(wallet.walletAddress, wallets, policy);
      if (recipients.length === 0) {
        summary.skipped++;
        continue;
      }

      const toAddress = pickRandom(recipients);
      const capUtilization = globalCapLimit > 0 ? globalUsed / globalCapLimit : 0;
      const amount = calculateAmount(policy.maxUsdcPerTx, policy.selectedStrategyId, capUtilization);
      const amountValue = Number(amount);

      if (globalUsed + amountValue > globalCapLimit) {
        summary.skipped++;
        continue;
      }

      summary.attempted++;

      if (ARC_AUTONOMY_DRY_RUN) {
        summary.submitted++;
        globalUsed += amountValue;
        continue;
      }

      try {
        await executeArcTransfer({
          agentIndex: wallet.agentIndex,
          toAddress,
          amount,
          requestedBy: ARC_AUTONOMY_REQUESTED_BY,
          estimateOnly: false,
          reason: 'Scheduled ARC autonomy transfer',
        });
        summary.submitted++;
        globalUsed += amountValue;

        if (lastRecipientAddress && lastRecipientAddress === toAddress.toLowerCase()) {
          recipientRepeatStreak++;
        } else {
          recipientRepeatStreak = 1;
          lastRecipientAddress = toAddress.toLowerCase();
        }

        summary.recipientRepeatStreak = recipientRepeatStreak;
        summary.recipientRepeatAddress = lastRecipientAddress ?? undefined;

        const repeatLimit = clampPositiveInt(ARC_AUTONOMY_RECIPIENT_REPEAT_LIMIT, 5);
        if (recipientRepeatStreak >= repeatLimit) {
          haltScheduler(`Repeated recipient pattern detected (${recipientRepeatStreak}): ${toAddress}`);
        }
      } catch {
        summary.failed++;
      }
    }

    summary.globalCapUsed = globalUsed;

    const refreshed = await refreshArcExecutionConfirmations();
    summary.confirmationsRefreshed = refreshed.refreshed;
    summary.confirmed = refreshed.confirmed;
    summary.pending = refreshed.pending;
    summary.failedConfirmations = refreshed.failed;

    lastTickAt = Date.now();
    summary.tickFinishedAt = lastTickAt;
    lastSummary = summary;

    if (summary.failed > 0) {
      consecutiveFailures++;
    } else {
      consecutiveFailures = 0;
    }

    const failureLimit = clampPositiveInt(ARC_AUTONOMY_CIRCUIT_BREAKER_FAILED_TICKS, 5);
    if (consecutiveFailures >= failureLimit) {
      haltScheduler(`Consecutive failed ticks reached ${consecutiveFailures}`);
    }

    pushTickHistory(summary);

    return summary;
  } catch (error) {
    consecutiveFailures++;
    summary.tickFinishedAt = Date.now();
    pushTickHistory(summary);

    const failureLimit = clampPositiveInt(ARC_AUTONOMY_CIRCUIT_BREAKER_FAILED_TICKS, 5);
    if (consecutiveFailures >= failureLimit) {
      haltScheduler(`Consecutive failed ticks reached ${consecutiveFailures}`);
    }

    throw error;
  } finally {
    tickInFlight = false;
  }
}

function scheduleNextTick() {
  if (!schedulerRunning) return;

  const interval = clampPositiveInt(ARC_AUTONOMY_INTERVAL_MS, 60000);
  schedulerTimer = setTimeout(async () => {
    try {
      await runArcAutonomyTick();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('[ARC Autonomy] Tick failed:', message);
    } finally {
      scheduleNextTick();
    }
  }, interval);
}

export function startArcAutonomyScheduler() {
  if (schedulerRunning || !ARC_AUTONOMY_ENABLED) return;

  haltedReason = null;
  consecutiveFailures = 0;
  schedulerRunning = true;
  scheduleNextTick();
  console.log(
    `[ARC Autonomy] Scheduler started (interval=${clampPositiveInt(ARC_AUTONOMY_INTERVAL_MS, 60000)}ms, ` +
      `maxActions=${clampPositiveInt(ARC_AUTONOMY_MAX_ACTIONS_PER_TICK, 2)}, dryRun=${ARC_AUTONOMY_DRY_RUN})`,
  );
}

export function stopArcAutonomyScheduler() {
  schedulerRunning = false;
  if (schedulerTimer) {
    clearTimeout(schedulerTimer);
    schedulerTimer = null;
  }
}

export function getArcAutonomyStatus() {
  return {
    enabled: ARC_AUTONOMY_ENABLED,
    running: schedulerRunning,
    intervalMs: clampPositiveInt(ARC_AUTONOMY_INTERVAL_MS, 60000),
    maxActionsPerTick: clampPositiveInt(ARC_AUTONOMY_MAX_ACTIONS_PER_TICK, 2),
    transferAmount: clampPositive(ARC_AUTONOMY_TRANSFER_AMOUNT, 1),
    globalMaxUsdcPerDay: clampPositive(ARC_AUTONOMY_GLOBAL_MAX_USDC_PER_DAY, 50),
    circuitBreakerFailedTicks: clampPositiveInt(ARC_AUTONOMY_CIRCUIT_BREAKER_FAILED_TICKS, 5),
    recipientRepeatLimit: clampPositiveInt(ARC_AUTONOMY_RECIPIENT_REPEAT_LIMIT, 5),
    dryRun: ARC_AUTONOMY_DRY_RUN,
    tickInFlight,
    lastTickAt,
    consecutiveFailures,
    haltedReason,
    tickHistory,
    lastSummary,
  };
}

export function getArcAutonomyDefaults(): ArcPolicyPatchInput {
  return {
    enabled: true,
    maxUsdcPerTx: 25,
    maxUsdcPerDay: 100,
    cooldownSeconds: 90,
  };
}
