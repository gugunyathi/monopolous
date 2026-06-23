/**
 * ArcAgentsPanel
 *
 * Displays the 10 ARC Protocol agents running on Arc testnet.
 * Shows network status, per-agent wallets, USDC balances, and
 * setup instructions when VITE_ARC_RPC_KEY is not configured.
 * 
 * Features:
 * - Inline policy editing with PolicyEditor modal
 * - ConfirmationQueue for retry/backoff of pending TXs when RPC unavailable
 * - Real-time execution journal with confirmation polling
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { ARC_AGENTS, ARC_CHAIN_ID, ARC_EXPLORER } from '../data/agents';
import {
  isArcConfigured,
  checkArcNetwork,
  provisionArcAgents,
  getAllArcAgentWallets,
  getArcNetworkStatus,
  getSetupInstructions,
  type ArcAgentWallet,
  type ArcNetworkStatus,
} from '../services/arcWalletService';
import {
  getArcExecutions,
  getArcPolicies,
  updateArcPolicy,
  type ArcExecutionRecord,
  type ArcPolicyRecord,
  type ArcExecutionRefreshSummary,
} from '../services/apiService';
import { ConfirmationQueue } from '../services/confirmationQueue';
import { PolicyEditor } from './PolicyEditor';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function shortAddress(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function shortId(id: string): string {
  return `${id.slice(0, 6)}…${id.slice(-4)}`;
}

function fmtTime(value?: string): string {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleTimeString();
}

const STATUS_COLOR: Record<string, string> = {
  connected: '#22c55e',
  connecting: '#eab308',
  error: '#ef4444',
  disconnected: '#6b7280',
};

const EXECUTION_STATUS_COLOR: Record<ArcExecutionRecord['status'], string> = {
  queued: '#f59e0b',
  estimated: '#38bdf8',
  submitted: '#f59e0b',
  confirmed: '#22c55e',
  failed: '#ef4444',
};

// ─── Component ────────────────────────────────────────────────────────────────

export function ArcAgentsPanel() {
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [wallets, setWallets] = useState<ArcAgentWallet[]>([]);
  const [network, setNetwork] = useState<ArcNetworkStatus>(getArcNetworkStatus());
  const [showSetup, setShowSetup] = useState(false);
  const [executions, setExecutions] = useState<ArcExecutionRecord[]>([]);
  const [policies, setPolicies] = useState<ArcPolicyRecord[]>([]);
  const [journalError, setJournalError] = useState<string | null>(null);
  const [lastRefreshSummary, setLastRefreshSummary] = useState<ArcExecutionRefreshSummary | null>(null);
  
  // Policy editing state
  const [editingPolicy, setEditingPolicy] = useState<ArcPolicyRecord | null>(null);
  const [savingPolicy, setSavingPolicy] = useState(false);
  const [policyError, setPolicyError] = useState<string | null>(null);
  
  // Confirmation queue state
  const queueRef = useRef<ConfirmationQueue | null>(null);
  const [queueStats, setQueueStats] = useState({ totalPending: 0, readyNow: 0, averageRetries: 0, oldestItem: 0 });
  
  const configured = isArcConfigured();

  const refreshJournal = useCallback(async (withRefreshPoll: boolean) => {
    const [execResult, policyResult] = await Promise.all([
      getArcExecutions(30, withRefreshPoll),
      getArcPolicies(),
    ]);
    setExecutions(execResult.executions);
    setPolicies(policyResult);
    setLastRefreshSummary(execResult.refresh ?? null);
    setJournalError(null);
    
    // Feed pending transactions into the confirmation queue
    if (queueRef.current && execResult.executions.length > 0) {
      const pendingTxs = execResult.executions.filter(
        (e) => e.status === 'submitted' && e.txHash
      );
      for (const tx of pendingTxs) {
        if (tx.txHash) {
          queueRef.current.enqueue(tx._id, tx.txHash, tx.agentIndex);
        }
      }
      
      // Update queue stats
      const stats = queueRef.current.getStats();
      setQueueStats(stats);
    }
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const net = await checkArcNetwork();
      setNetwork(net);
      if (net.connected) {
        const ws = await provisionArcAgents();
        setWallets(ws);
      } else {
        setWallets(getAllArcAgentWallets());
      }

      try {
        await refreshJournal(true);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load ARC journal';
        setJournalError(message);
      }
    } finally {
      setLoading(false);
    }
  }, [refreshJournal]);

  // Handle policy save
  const handleSavePolicy = useCallback(async (updates: Parameters<typeof updateArcPolicy>[1]) => {
    if (!editingPolicy) return;
    
    setSavingPolicy(true);
    setPolicyError(null);
    
    try {
      const updated = await updateArcPolicy(editingPolicy.agentIndex, updates);
      
      // Update policies list
      setPolicies((prev) =>
        prev.map((p) => (p.agentIndex === updated.agentIndex ? updated : p))
      );
      
      setEditingPolicy(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save policy';
      setPolicyError(message);
      console.error('Policy save error:', message);
    } finally {
      setSavingPolicy(false);
    }
  }, [editingPolicy]);

  // Auto-provision on first expand
  useEffect(() => {
    if (expanded && configured && wallets.length === 0) {
      void refresh();
    }
  }, [expanded, configured, wallets.length, refresh]);

  // Initialize confirmation queue
  useEffect(() => {
    if (!queueRef.current) {
      // Process callback: when items are ready, trigger a refresh to check confirmations
      queueRef.current = new ConfirmationQueue(
        async (executionIds) => {
          // Trigger journal refresh which will poll confirmations from RPC
          await refreshJournal(true);
        },
        {
          initialBackoffMs: 5000,
          maxBackoffMs: 300000,
          maxRetries: 50,
        }
      );
    }

    return () => {
      // Cleanup queue stats on unmount
      if (queueRef.current) {
        const stats = queueRef.current.getStats();
        if (stats.totalPending > 0) {
          console.log('[ArcAgentsPanel] Confirmation queue cleanup:', stats);
        }
      }
    };
  }, [refreshJournal]);

  useEffect(() => {
    if (!expanded) return;
    const timer = setInterval(() => {
      void refreshJournal(true).catch((err) => {
        const message = err instanceof Error ? err.message : 'Failed to refresh ARC journal';
        setJournalError(message);
      });
    }, 12_000);

    return () => clearInterval(timer);
  }, [expanded, refreshJournal]);

  const connectedCount = wallets.filter((w) => w.status === 'connected').length;
  const totalUsdc = wallets.reduce((s, w) => {
    const v = parseFloat(w.usdcBalance);
    return s + (isNaN(v) ? 0 : v);
  }, 0);

  // ── Collapsed badge ───────────────────────────────────────────────────────
  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/60 px-3 py-2 text-xs font-bold uppercase tracking-widest text-white backdrop-blur hover:bg-white/10 transition-colors"
        style={{ pointerEvents: 'auto' }}
      >
        <span
          className="h-2 w-2 rounded-full"
          style={{ background: network.connected ? '#22c55e' : configured ? '#eab308' : '#6b7280' }}
        />
        <span>ARC</span>
        <span className="text-white/50">·</span>
        <span className="font-mono text-cyan-300">{connectedCount}/{ARC_AGENTS.length}</span>
      </button>
    );
  }

  // ── Expanded panel ────────────────────────────────────────────────────────
  return (
      <>
    <div
      className="flex flex-col rounded-2xl border border-white/10 bg-black/80 backdrop-blur text-white"
      style={{ width: 340, maxHeight: 520, pointerEvents: 'auto' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div className="flex items-center gap-2">
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ background: network.connected ? '#22c55e' : configured ? '#eab308' : '#6b7280' }}
          />
          <span className="text-sm font-black uppercase tracking-widest">ARC Testnet</span>
          <span className="rounded bg-white/10 px-1.5 py-0.5 text-[9px] font-bold text-cyan-300">
            Chain {ARC_CHAIN_ID}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => void refresh()}
            disabled={loading}
            className="rounded-lg bg-white/10 px-2 py-1 text-[10px] font-bold uppercase hover:bg-white/20 disabled:opacity-40"
          >
            {loading ? '…' : 'Refresh'}
          </button>
          <button
            onClick={() => setExpanded(false)}
            className="rounded-lg bg-white/10 px-2 py-1 text-[10px] font-bold hover:bg-white/20"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Not configured */}
      {!configured && (
        <div className="flex flex-col gap-3 p-4">
          <p className="text-xs text-amber-300">
            <strong>VITE_ARC_RPC_KEY</strong> is not set. Add it to your <code>.env</code> to connect ARC agents.
          </p>
          <button
            onClick={() => setShowSetup((v) => !v)}
            className="rounded-lg bg-cyan-500/20 px-3 py-2 text-xs font-bold text-cyan-300 hover:bg-cyan-500/30"
          >
            {showSetup ? 'Hide' : 'Show'} Setup Instructions
          </button>
          {showSetup && (
            <pre className="overflow-x-auto rounded-lg bg-zinc-900 p-3 text-[10px] text-zinc-300 whitespace-pre-wrap">
              {getSetupInstructions()}
            </pre>
          )}
          {/* Still show agents in preview mode */}
        </div>
      )}

      {/* Network error */}
      {configured && !network.connected && network.error && (
        <div className="mx-4 mt-3 rounded-lg border border-red-400/30 bg-red-400/10 px-3 py-2 text-xs text-red-300">
          {network.error}
        </div>
      )}

      {/* Stats bar */}
      {configured && (
        <div className="grid grid-cols-3 gap-px border-b border-white/10 bg-white/5 text-center">
          <div className="bg-black/40 py-2">
            <p className="text-[10px] uppercase text-zinc-500">Agents</p>
            <p className="text-sm font-black">{connectedCount}<span className="text-zinc-600">/{ARC_AGENTS.length}</span></p>
          </div>
          <div className="bg-black/40 py-2">
            <p className="text-[10px] uppercase text-zinc-500">Total USDC</p>
            <p className="text-sm font-black text-green-400">${totalUsdc.toFixed(2)}</p>
          </div>
          <div className="bg-black/40 py-2">
            <p className="text-[10px] uppercase text-zinc-500">Block</p>
            <p className="text-sm font-black font-mono text-cyan-300">
              {network.blockNumber > 0 ? network.blockNumber.toLocaleString() : '—'}
            </p>
          </div>
        </div>
      )}

      {/* Agent list */}
      <div className="flex-1 overflow-y-auto">
        {ARC_AGENTS.map((agent) => {
          const w = wallets.find((x) => x.agentIndex === agent.index);
          const statusColor = STATUS_COLOR[w?.status ?? 'disconnected'];
          return (
            <div
              key={agent.index}
              className="flex items-center gap-3 border-b border-white/5 px-4 py-2.5 hover:bg-white/5"
            >
              {/* Color dot */}
              <div
                className="h-3 w-3 flex-shrink-0 rounded-full"
                style={{ background: agent.color }}
              />

              {/* Info */}
              <div className="min-w-0 flex-1">
                <p className="truncate text-[11px] font-bold">{agent.role}</p>
                <p className="truncate text-[10px] text-zinc-500 font-mono">
                  {w ? shortAddress(w.address) : shortAddress(agent.wallet.address)}
                </p>
              </div>

              {/* Balance */}
              <div className="text-right">
                <p className="text-[11px] font-bold text-green-400">
                  {w ? `$${w.usdcBalance}` : '—'}
                </p>
                <p className="text-[9px] text-zinc-600">USDC</p>
              </div>

              {/* Status */}
              <div
                className="h-2 w-2 flex-shrink-0 rounded-full"
                style={{ background: statusColor }}
              />

              {/* Explorer link */}
              {w && (
                <a
                  href={w.explorerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-shrink-0 rounded bg-white/10 px-1.5 py-0.5 text-[9px] font-bold hover:bg-white/20"
                  title="View on ArcScan"
                >
                  ↗
                </a>
              )}
            </div>
          );
        })}
      </div>

      {/* ARC policy table */}
      <div className="border-t border-white/10 px-4 py-3">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[10px] font-black uppercase tracking-widest text-cyan-300">ARC Policy Table</p>
          <div className="flex items-center gap-2">
            <p className="text-[9px] text-zinc-500">{policies.length} policies</p>
            {queueStats.totalPending > 0 && (
              <span className="text-[9px] text-amber-400" title={`${queueStats.readyNow} ready, avg ${queueStats.averageRetries.toFixed(1)} retries`}>
                ⏱ {queueStats.totalPending}
              </span>
            )}
          </div>
        </div>
        <div className="max-h-28 overflow-y-auto rounded-lg border border-white/10">
          {policies.length === 0 && (
            <div className="px-2 py-2 text-[10px] text-zinc-500">No ARC policies found</div>
          )}
          {policies.map((policy) => {
            const arcAgent = ARC_AGENTS.find((a) => a.index === policy.agentIndex);
            return (
              <div 
                key={policy._id}
                className="grid grid-cols-[1.2fr_0.78fr_0.9fr_1fr_0.85fr_0.5fr] items-center border-b border-white/5 px-2 py-1.5 text-[10px] hover:bg-white/5 group cursor-pointer"
                onClick={() => setEditingPolicy(policy)}
              >
                <span className="truncate text-zinc-300">{arcAgent?.role ?? `Agent ${policy.agentIndex}`}</span>
                <span className="truncate text-[9px] text-fuchsia-300 font-mono">{policy.selectedStrategyId ?? 'two_sigma_risk'}</span>
                <span className="text-cyan-300 font-mono">${policy.maxUsdcPerTx}</span>
                <span className="text-emerald-300 font-mono">${policy.maxUsdcPerDay}</span>
                <span className="text-zinc-400 font-mono">{policy.cooldownSeconds}s</span>
                <button
                  className="opacity-0 group-hover:opacity-100 rounded px-1 py-0.5 text-[9px] font-bold bg-white/10 hover:bg-white/20 transition-all"
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingPolicy(policy);
                  }}
                  title="Edit policy"
                >
                  ✎
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Execution journal */}
      <div className="border-t border-white/10 px-4 py-3">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[10px] font-black uppercase tracking-widest text-cyan-300">Execution Journal</p>
          <button
            onClick={() => void refreshJournal(true)}
            className="rounded bg-white/10 px-2 py-1 text-[9px] font-bold uppercase hover:bg-white/20"
          >
            Poll Confirmations
          </button>
        </div>

        {lastRefreshSummary && (
          <p className="mb-2 text-[9px] text-zinc-500">
            poll: {lastRefreshSummary.confirmed} confirmed · {lastRefreshSummary.pending} pending · {lastRefreshSummary.failed} failed
          </p>
        )}

        {journalError && (
          <div className="mb-2 rounded border border-amber-400/30 bg-amber-400/10 px-2 py-1 text-[10px] text-amber-200">
            {journalError}
          </div>
        )}

        <div className="max-h-32 overflow-y-auto rounded-lg border border-white/10">
          {executions.length === 0 && (
            <div className="px-2 py-2 text-[10px] text-zinc-500">No ARC executions yet</div>
          )}
          {executions.map((execution) => {
            const arcAgent = ARC_AGENTS.find((a) => a.index === execution.agentIndex);
            return (
              <div key={execution._id} className="border-b border-white/5 px-2 py-1.5">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="truncate text-zinc-300">{arcAgent?.role ?? `Agent ${execution.agentIndex}`}</span>
                  <span style={{ color: EXECUTION_STATUS_COLOR[execution.status] }} className="font-bold uppercase">
                    {execution.status}
                  </span>
                </div>
                <div className="text-[9px] text-zinc-500">
                  ${execution.amount} → {shortAddress(execution.toAddress)} · {fmtTime(execution.createdAt)}
                </div>
                <div className="text-[9px] text-zinc-600">
                  exec {shortId(execution._id)}{execution.txHash ? ` · tx ${shortAddress(execution.txHash)}` : ''}
                  {execution.confirmations ? ` · ${execution.confirmations} conf` : ''}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-white/10 px-4 py-2">
        <span className="text-[10px] text-zinc-600">
          USDC gas · Arc Testnet · Chain {ARC_CHAIN_ID}
        </span>
        <a
          href={ARC_EXPLORER}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[10px] text-cyan-500 hover:text-cyan-300"
        >
          ArcScan ↗
        </a>
      </div>
    </div>

    {/* Policy Editor Modal */}
    {editingPolicy && (
      <PolicyEditor
        policy={editingPolicy}
        onSave={handleSavePolicy}
        onCancel={() => {
          setEditingPolicy(null);
          setPolicyError(null);
        }}
        isSaving={savingPolicy}
      />
    )}

    {/* Global error display */}
    {policyError && (
      <div
        className="fixed top-4 left-4 rounded-lg border border-red-400/30 bg-red-400/10 px-4 py-2 text-xs text-red-300 z-40 animate-pulse"
        onClick={() => setPolicyError(null)}
      >
        {policyError}
      </div>
    )}
  </>
  );
}

export default ArcAgentsPanel;
