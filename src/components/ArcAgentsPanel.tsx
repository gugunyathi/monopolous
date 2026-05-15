/**
 * ArcAgentsPanel
 *
 * Displays the 10 ARC Protocol agents running on Arc testnet.
 * Shows network status, per-agent wallets, USDC balances, and
 * setup instructions when VITE_ARC_RPC_KEY is not configured.
 */

import { useState, useEffect, useCallback } from 'react';
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function shortAddress(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

const STATUS_COLOR: Record<string, string> = {
  connected: '#22c55e',
  connecting: '#eab308',
  error: '#ef4444',
  disconnected: '#6b7280',
};

// ─── Component ────────────────────────────────────────────────────────────────

export function ArcAgentsPanel() {
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [wallets, setWallets] = useState<ArcAgentWallet[]>([]);
  const [network, setNetwork] = useState<ArcNetworkStatus>(getArcNetworkStatus());
  const [showSetup, setShowSetup] = useState(false);
  const configured = isArcConfigured();

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
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-provision on first expand
  useEffect(() => {
    if (expanded && configured && wallets.length === 0) {
      void refresh();
    }
  }, [expanded, configured, wallets.length, refresh]);

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
  );
}

export default ArcAgentsPanel;
