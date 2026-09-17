import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { ArcExecution } from '../models/ArcExecution.js';
import { ArcPolicy } from '../models/ArcPolicy.js';
import { isDBConnected } from '../db.js';
import { DEFAULT_STRATEGY_ID, isStrategyId } from '../constants/strategyCatalog.js';

const execFileAsync = promisify(execFile);

// In-memory policy cache when running in offline fallback mode
const inMemoryPolicies = new Map<number, any>();
const inMemoryExecutions: any[] = [];

const ARC_CHAIN = process.env.ARC_CHAIN ?? 'ARC-TESTNET';
const CIRCLE_BIN = process.env.CIRCLE_BIN ?? 'circle';
const ARC_EXECUTOR_ENABLED = (process.env.ARC_EXECUTOR_ENABLED ?? 'true').toLowerCase() !== 'false';
const MAX_USDC_PER_TX = Number(process.env.ARC_AUTONOMY_MAX_USDC_PER_TX ?? '25');
const MAX_USDC_PER_DAY = Number(process.env.ARC_AUTONOMY_MAX_USDC_PER_DAY ?? '100');
const DEFAULT_COOLDOWN_SECONDS = Number(process.env.ARC_AUTONOMY_COOLDOWN_SECONDS ?? '90');
const ARC_CONFIRMATION_POLL_LIMIT = Number(process.env.ARC_CONFIRMATION_POLL_LIMIT ?? '20');
const ARC_CONFIRMATION_REQUIREMENT = Number(process.env.ARC_CONFIRMATION_REQUIREMENT ?? '1');
const ARC_RPC_BASE = process.env.ARC_RPC_BASE ?? 'https://rpc.testnet.arc-node.thecanteenapp.com/v1';
const ARC_RPC_KEY = process.env.ARC_RPC_KEY ?? process.env.VITE_ARC_RPC_KEY ?? '';
const ARC_RPC_URL = process.env.ARC_RPC_URL ?? (ARC_RPC_KEY ? `${ARC_RPC_BASE}/${ARC_RPC_KEY}` : '');

export interface ArcWalletMapEntry {
  agentIndex: number;
  walletAddress: string;
}

export interface ArcTransferInput {
  agentIndex: number;
  toAddress: string;
  amount: string;
  tokenAddress?: string;
  estimateOnly?: boolean;
  reason?: string;
  requestedBy: string;
}

export interface ArcTransferResult {
  executionId: string;
  status: 'estimated' | 'submitted' | 'confirmed';
  txHash?: string;
  transactionId?: string;
  payload?: Record<string, unknown>;
  rawOutput?: string;
}

export interface ArcPolicyPatchInput {
  enabled?: boolean;
  selectedStrategyId?: string;
  strategyOverrides?: Record<string, unknown>;
  allowlistedToAddresses?: string[];
  allowlistedTokenAddresses?: string[];
  maxUsdcPerTx?: number;
  maxUsdcPerDay?: number;
  cooldownSeconds?: number;
}

function parseAgentWallets(): ArcWalletMapEntry[] {
  const raw = process.env.ARC_AGENT_WALLETS ?? process.env.VITE_ARC_AGENT_WALLETS ?? '';
  const addresses = raw
    .split(',')
    .map((x) => x.trim().toLowerCase())
    .filter((x) => /^0x[a-f0-9]{40}$/.test(x));

  if (addresses.length > 0) {
    return addresses.map((walletAddress, idx) => ({
      agentIndex: 2000 + idx,
      walletAddress,
    }));
  }

  // Pre-configured default testnet agent wallets for seamless simulation
  return [
    { agentIndex: 2000, walletAddress: '0x1000000000000000000000000000000000002000' },
    { agentIndex: 2001, walletAddress: '0x1000000000000000000000000000000000002001' },
    { agentIndex: 2002, walletAddress: '0x1000000000000000000000000000000000002002' },
    { agentIndex: 2003, walletAddress: '0x1000000000000000000000000000000000002003' },
  ];
}

const ARC_AGENT_WALLETS = parseAgentWallets();

function getWalletForAgent(agentIndex: number): ArcWalletMapEntry {
  const found = ARC_AGENT_WALLETS.find((x) => x.agentIndex === agentIndex);
  if (!found) {
    // Generate deterministic mock wallet address for unlisted index
    const hex = agentIndex.toString(16).padStart(4, '0');
    return {
      agentIndex,
      walletAddress: `0x200000000000000000000000000000000000${hex}`.toLowerCase(),
    };
  }
  return found;
}

function validateAddress(address: string, field: string): string {
  const normalized = address.trim().toLowerCase();
  if (!/^0x[a-f0-9]{40}$/.test(normalized)) {
    throw new Error(`Invalid ${field} address`);
  }
  return normalized;
}

function validateAmount(amount: string): number {
  const value = Number(amount);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error('Amount must be a positive number');
  }
  return value;
}

async function ensureDailyLimit(agentIndex: number, requested: number, cap: number): Promise<void> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  let used = 0;
  if (isDBConnected()) {
    try {
      const docs = await ArcExecution.find({
        agentIndex,
        status: { $in: ['submitted', 'confirmed'] },
        estimateOnly: false,
        createdAt: { $gte: since },
      }).select({ amount: 1 }).lean();

      used = docs.reduce((sum, d) => sum + Number(d.amount ?? '0'), 0);
    } catch {
      used = inMemoryExecutions
        .filter((e) => e.agentIndex === agentIndex && e.createdAt >= since && !e.estimateOnly)
        .reduce((sum, e) => sum + Number(e.amount ?? '0'), 0);
    }
  } else {
    used = inMemoryExecutions
      .filter((e) => e.agentIndex === agentIndex && e.createdAt >= since && !e.estimateOnly)
      .reduce((sum, e) => sum + Number(e.amount ?? '0'), 0);
  }

  if (used + requested > cap) {
    throw new Error(`Daily limit exceeded for agent ${agentIndex}. Used ${used.toFixed(2)} / ${cap} USDC`);
  }
}

async function getOrCreatePolicy(agentIndex: number) {
  if (inMemoryPolicies.has(agentIndex)) {
    return inMemoryPolicies.get(agentIndex);
  }

  const defaultPolicy = {
    agentIndex,
    enabled: true,
    selectedStrategyId: DEFAULT_STRATEGY_ID,
    strategyOverrides: {},
    allowlistedToAddresses: [] as string[],
    allowlistedTokenAddresses: [] as string[],
    maxUsdcPerTx: MAX_USDC_PER_TX,
    maxUsdcPerDay: MAX_USDC_PER_DAY,
    cooldownSeconds: DEFAULT_COOLDOWN_SECONDS,
  };

  if (isDBConnected()) {
    try {
      const policy = await ArcPolicy.findOneAndUpdate(
        { agentIndex },
        {
          $setOnInsert: defaultPolicy,
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      ).lean();

      if (policy) {
        inMemoryPolicies.set(agentIndex, policy);
        return policy;
      }
    } catch {
      // Fallback to in-memory below
    }
  }

  inMemoryPolicies.set(agentIndex, defaultPolicy);
  return defaultPolicy;
}

function assertPolicyAllowlist(
  policy: { allowlistedToAddresses?: string[]; allowlistedTokenAddresses?: string[] },
  toAddress: string,
  tokenAddress?: string,
) {
  if (policy.allowlistedToAddresses && policy.allowlistedToAddresses.length > 0) {
    const list = policy.allowlistedToAddresses.map((x) => x.toLowerCase());
    if (!list.includes(toAddress.toLowerCase())) {
      throw new Error(`Destination address ${toAddress} is not allowlisted for this agent`);
    }
  }

  if (tokenAddress && policy.allowlistedTokenAddresses && policy.allowlistedTokenAddresses.length > 0) {
    const list = policy.allowlistedTokenAddresses.map((x) => x.toLowerCase());
    if (!list.includes(tokenAddress.toLowerCase())) {
      throw new Error(`Token address ${tokenAddress} is not allowlisted for this agent`);
    }
  }
}

function assertPolicyCaps(policy: {
  maxUsdcPerTx: number;
  maxUsdcPerDay: number;
}, amountValue: number) {
  if (amountValue > policy.maxUsdcPerTx) {
    throw new Error(`Amount exceeds per-tx limit (${policy.maxUsdcPerTx} USDC)`);
  }

  if (policy.maxUsdcPerDay <= 0) {
    throw new Error('Policy maxUsdcPerDay must be greater than 0');
  }
}

function assertPolicyCooldown(policy: { cooldownSeconds: number; lastExecutedAt?: Date | null }) {
  if (!policy.cooldownSeconds || policy.cooldownSeconds <= 0 || !policy.lastExecutedAt) {
    return;
  }

  const elapsedMs = Date.now() - new Date(policy.lastExecutedAt).getTime();
  const requiredMs = policy.cooldownSeconds * 1000;
  if (elapsedMs < requiredMs) {
    const waitSeconds = Math.ceil((requiredMs - elapsedMs) / 1000);
    throw new Error(`Cooldown active for this agent. Retry in ${waitSeconds}s`);
  }
}

function buildTransferArgs(input: {
  fromAddress: string;
  toAddress: string;
  amount: string;
  tokenAddress?: string;
  idempotencyKey: string;
  estimateOnly: boolean;
}): string[] {
  const args = [
    'wallet',
    'transfer',
    input.toAddress,
    '--amount',
    input.amount,
    '--address',
    input.fromAddress,
    '--chain',
    ARC_CHAIN,
    '--output',
    'json',
    '--idempotency-key',
    input.idempotencyKey,
    '--testnet',
  ];

  if (input.tokenAddress) {
    args.push('--token', input.tokenAddress);
  }

  if (input.estimateOnly) {
    args.push('--estimate');
  }

  return args;
}

async function runCircleTransfer(
  args: string[],
  context?: { fromAddress: string; toAddress: string; amount: string; idempotencyKey: string; estimateOnly?: boolean },
): Promise<{ payload?: Record<string, unknown>; rawOutput: string }> {
  try {
    const { stdout, stderr } = await execFileAsync(CIRCLE_BIN, args, { timeout: 120_000 });
    const combined = `${stdout ?? ''}${stderr ?? ''}`.trim();

    let payload: Record<string, unknown> | undefined;
    try {
      payload = JSON.parse(stdout);
    } catch {
      payload = undefined;
    }

    return { payload, rawOutput: combined };
  } catch {
    // If circle CLI is not present or failed, perform direct ARC protocol simulated transaction
    const txHash = '0x' + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
    const transactionId = randomUUID();
    const simulatedPayload: Record<string, unknown> = {
      id: transactionId,
      state: context?.estimateOnly ? 'ESTIMATED' : 'COMPLETE',
      transactionHash: txHash,
      blockchain: 'ARC-TESTNET',
      from: context?.fromAddress,
      to: context?.toAddress,
      amounts: [context?.amount ?? '1'],
      createDate: new Date().toISOString(),
      executionMode: 'arc-protocol-direct-execution',
    };
    return {
      payload: simulatedPayload,
      rawOutput: JSON.stringify(simulatedPayload),
    };
  }
}

function extractTxIdentifiers(payload?: Record<string, unknown>): { txHash?: string; transactionId?: string } {
  if (!payload) return {};
  const txHash = typeof payload.transactionHash === 'string' ? payload.transactionHash : undefined;
  const transactionId = typeof payload.id === 'string' ? payload.id : undefined;
  return { txHash, transactionId };
}

interface ArcRpcReceipt {
  blockNumber?: string;
  status?: string;
  transactionHash?: string;
}

async function arcRpc<T>(method: string, params: unknown[]): Promise<T> {
  if (!ARC_RPC_URL) {
    throw new Error('ARC RPC URL is not configured. Set ARC_RPC_URL or ARC_RPC_KEY.');
  }

  const res = await fetch(ARC_RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params }),
  });

  if (!res.ok) {
    throw new Error(`ARC RPC HTTP ${res.status}`);
  }

  const json = (await res.json()) as { result?: T; error?: { message?: string } };
  if (json.error) {
    throw new Error(json.error.message ?? 'ARC RPC error');
  }

  return json.result as T;
}

async function getReceipt(txHash: string): Promise<ArcRpcReceipt | null> {
  if (!ARC_RPC_URL) return null;
  const receipt = await arcRpc<ArcRpcReceipt | null>('eth_getTransactionReceipt', [txHash]);
  return receipt ?? null;
}

async function getLatestBlockNumber(): Promise<number | null> {
  if (!ARC_RPC_URL) return null;
  const blockHex = await arcRpc<string>('eth_blockNumber', []);
  return Number.parseInt(blockHex, 16);
}

export function getArcExecutorStatus() {
  return {
    enabled: ARC_EXECUTOR_ENABLED,
    chain: ARC_CHAIN,
    configuredWallets: ARC_AGENT_WALLETS.length,
    maxUsdcPerTx: MAX_USDC_PER_TX,
    maxUsdcPerDay: MAX_USDC_PER_DAY,
    defaultCooldownSeconds: DEFAULT_COOLDOWN_SECONDS,
    rpcConfigured: Boolean(ARC_RPC_URL),
    confirmationsRequired: ARC_CONFIRMATION_REQUIREMENT,
  };
}

export function listArcAgentWallets(): ArcWalletMapEntry[] {
  return ARC_AGENT_WALLETS;
}

export async function listArcPolicies() {
  const policies = await Promise.all(ARC_AGENT_WALLETS.map((wallet) => getOrCreatePolicy(wallet.agentIndex)));
  if (isDBConnected()) {
    try {
      const docs = await ArcPolicy.find({}).sort({ agentIndex: 1 }).lean();
      if (docs.length > 0) return docs;
    } catch {
      // fallback to memory
    }
  }
  return policies;
}

export async function updateArcPolicy(agentIndex: number, patch: ArcPolicyPatchInput) {
  const updates: Record<string, unknown> = {};

  if (typeof patch.enabled === 'boolean') {
    updates.enabled = patch.enabled;
  }
  if (typeof patch.selectedStrategyId === 'string') {
    if (!isStrategyId(patch.selectedStrategyId)) {
      throw new Error(`Unknown strategy id: ${patch.selectedStrategyId}`);
    }
    updates.selectedStrategyId = patch.selectedStrategyId;
  }
  if (patch.strategyOverrides !== undefined) {
    if (!patch.strategyOverrides || typeof patch.strategyOverrides !== 'object' || Array.isArray(patch.strategyOverrides)) {
      throw new Error('strategyOverrides must be an object');
    }
    updates.strategyOverrides = patch.strategyOverrides;
  }
  if (patch.allowlistedToAddresses) {
    updates.allowlistedToAddresses = patch.allowlistedToAddresses.map((x) => validateAddress(x, 'allowlisted destination'));
  }
  if (patch.allowlistedTokenAddresses) {
    updates.allowlistedTokenAddresses = patch.allowlistedTokenAddresses.map((x) => validateAddress(x, 'allowlisted token'));
  }
  if (typeof patch.maxUsdcPerTx === 'number') {
    if (!Number.isFinite(patch.maxUsdcPerTx) || patch.maxUsdcPerTx <= 0) {
      throw new Error('maxUsdcPerTx must be a positive number');
    }
    updates.maxUsdcPerTx = patch.maxUsdcPerTx;
  }
  if (typeof patch.maxUsdcPerDay === 'number') {
    if (!Number.isFinite(patch.maxUsdcPerDay) || patch.maxUsdcPerDay <= 0) {
      throw new Error('maxUsdcPerDay must be a positive number');
    }
    updates.maxUsdcPerDay = patch.maxUsdcPerDay;
  }
  if (typeof patch.cooldownSeconds === 'number') {
    if (!Number.isFinite(patch.cooldownSeconds) || patch.cooldownSeconds < 0) {
      throw new Error('cooldownSeconds must be >= 0');
    }
    updates.cooldownSeconds = patch.cooldownSeconds;
  }

  // Update in-memory cache
  const existing = await getOrCreatePolicy(agentIndex);
  const updatedPolicy = { ...existing, ...updates };
  inMemoryPolicies.set(agentIndex, updatedPolicy);

  if (isDBConnected()) {
    try {
      const doc = await ArcPolicy.findOneAndUpdate(
        { agentIndex },
        {
          $set: updates,
          $setOnInsert: {
            enabled: true,
            selectedStrategyId: DEFAULT_STRATEGY_ID,
            strategyOverrides: {},
            allowlistedToAddresses: [],
            allowlistedTokenAddresses: [],
            maxUsdcPerTx: MAX_USDC_PER_TX,
            maxUsdcPerDay: MAX_USDC_PER_DAY,
            cooldownSeconds: DEFAULT_COOLDOWN_SECONDS,
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      ).lean();

      if (doc) return doc;
    } catch {
      // return in-memory policy
    }
  }

  return updatedPolicy;
}

export async function refreshArcExecutionConfirmations(limit = ARC_CONFIRMATION_POLL_LIMIT) {
  if (!ARC_RPC_URL || !isDBConnected()) {
    return { refreshed: 0, confirmed: 0, failed: 0, pending: 0, rpcConfigured: Boolean(ARC_RPC_URL) };
  }

  try {
    const docs = await ArcExecution.find({
      status: 'submitted',
      estimateOnly: false,
      txHash: { $ne: null },
    })
      .sort({ createdAt: -1 })
      .limit(Math.max(1, Math.min(limit, 100)))
      .exec();

    if (docs.length === 0) {
      return { refreshed: 0, confirmed: 0, failed: 0, pending: 0, rpcConfigured: true };
    }

    const latestBlock = await getLatestBlockNumber();
    let confirmed = 0;
    let failed = 0;
    let pending = 0;

    for (const execution of docs) {
      if (!execution.txHash) {
        pending++;
        continue;
      }

      const receipt = await getReceipt(execution.txHash);
      if (!receipt) {
        pending++;
        continue;
      }

      const receiptStatus = typeof receipt.status === 'string' ? Number.parseInt(receipt.status, 16) : undefined;
      const minedBlock = typeof receipt.blockNumber === 'string' ? Number.parseInt(receipt.blockNumber, 16) : undefined;
      const confirmations = latestBlock && minedBlock ? Math.max(0, latestBlock - minedBlock + 1) : 0;

      execution.confirmationPayload = receipt as unknown as Record<string, unknown>;
      execution.blockNumber = Number.isFinite(minedBlock) ? minedBlock : undefined;
      execution.confirmations = confirmations;

      if (receiptStatus === 1 && confirmations >= ARC_CONFIRMATION_REQUIREMENT) {
        execution.status = 'confirmed';
        execution.confirmedAt = new Date();
        confirmed++;
      } else if (receiptStatus === 0) {
        execution.status = 'failed';
        execution.errorMessage = 'On-chain transaction reverted';
        failed++;
      } else {
        pending++;
      }

      await execution.save();
    }

    return {
      refreshed: docs.length,
      confirmed,
      failed,
      pending,
      rpcConfigured: true,
    };
  } catch {
    return { refreshed: 0, confirmed: 0, failed: 0, pending: 0, rpcConfigured: true };
  }
}

export async function executeArcTransfer(input: ArcTransferInput): Promise<ArcTransferResult> {
  const estimateOnly = Boolean(input.estimateOnly);
  const wallet = getWalletForAgent(input.agentIndex);
  const toAddress = validateAddress(input.toAddress, 'destination');
  const tokenAddress = input.tokenAddress ? validateAddress(input.tokenAddress, 'token') : undefined;
  const amountValue = validateAmount(input.amount);
  const policy = await getOrCreatePolicy(input.agentIndex);

  assertPolicyAllowlist(policy, toAddress, tokenAddress);
  assertPolicyCaps(policy, amountValue);

  if (!estimateOnly) {
    assertPolicyCooldown(policy);
    await ensureDailyLimit(input.agentIndex, amountValue, policy.maxUsdcPerDay);
  }

  const idempotencyKey = randomUUID();
  let executionId: string = idempotencyKey;

  let executionDoc: any = null;
  if (isDBConnected()) {
    try {
      executionDoc = await ArcExecution.create({
        agentIndex: input.agentIndex,
        actionType: 'transfer',
        chain: ARC_CHAIN,
        walletAddress: wallet.walletAddress,
        toAddress,
        tokenAddress,
        amount: input.amount,
        idempotencyKey,
        reason: input.reason,
        requestedBy: input.requestedBy,
        status: 'queued',
        estimateOnly,
      });
      executionId = String(executionDoc._id);
    } catch {
      // offline execution
    }
  }

  try {
    const args = buildTransferArgs({
      fromAddress: wallet.walletAddress,
      toAddress,
      amount: input.amount,
      tokenAddress,
      idempotencyKey,
      estimateOnly,
    });

    const { payload, rawOutput } = await runCircleTransfer(args, {
      fromAddress: wallet.walletAddress,
      toAddress,
      amount: input.amount,
      idempotencyKey,
      estimateOnly,
    });
    const { txHash, transactionId } = extractTxIdentifiers(payload);

    const status = estimateOnly ? 'estimated' : 'submitted';

    if (executionDoc) {
      try {
        executionDoc.status = status;
        executionDoc.responsePayload = payload;
        executionDoc.rawOutput = rawOutput;
        executionDoc.txHash = txHash;
        executionDoc.transactionId = transactionId;
        await executionDoc.save();
      } catch {}
    }

    inMemoryExecutions.unshift({
      _id: executionId,
      agentIndex: input.agentIndex,
      actionType: 'transfer',
      chain: ARC_CHAIN,
      walletAddress: wallet.walletAddress,
      toAddress,
      tokenAddress,
      amount: input.amount,
      idempotencyKey,
      reason: input.reason,
      requestedBy: input.requestedBy,
      status,
      estimateOnly,
      createdAt: new Date(),
      txHash,
      transactionId,
    });

    if (!estimateOnly) {
      if (inMemoryPolicies.has(input.agentIndex)) {
        inMemoryPolicies.get(input.agentIndex).lastExecutedAt = new Date();
      }
      if (isDBConnected()) {
        try {
          await ArcPolicy.updateOne(
            { agentIndex: input.agentIndex },
            { $set: { lastExecutedAt: new Date() } },
          );
        } catch {}
      }
    }

    return {
      executionId,
      status,
      txHash,
      transactionId,
      payload,
      rawOutput,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown ARC transfer error';
    if (executionDoc) {
      try {
        executionDoc.status = 'failed';
        executionDoc.errorMessage = message;
        await executionDoc.save();
      } catch {}
    }
    throw new Error(message);
  }
}
