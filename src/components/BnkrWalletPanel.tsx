/**
 * BnkrWalletPanel
 *
 * Displays the BNKR wallet connection status, master wallet address,
 * per-agent wallet overview, and treasury statistics.
 * Rendered as an interactive top-bar button that opens a drop-down card.
 */

import React, { useState, useMemo } from 'react';
import { useStore } from '../store/useStore';
import { AGENTS } from '../data/agents';
import { Landmark, ChevronDown, ChevronUp, Copy, ExternalLink, Check, Users, Building2, BarChart3 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export function BnkrWalletPanel() {
  const bnkrMasterAddress = useStore((s) => s.bnkrMasterAddress);
  const connectionStatus = useStore((s) => s.bnkrConnectionStatus);
  const bnkrWallets = useStore((s) => s.bnkrWallets);
  const [expanded, setExpanded] = useState(false);
  const [tab, setTab] = useState<'overview' | 'agents' | 'departments'>('overview');
  const [copied, setCopied] = useState(false);

  const stats = useMemo(() => {
    const connected = bnkrWallets.filter((w) => w.status === 'connected').length;
    const totalAlloc = bnkrWallets.reduce((s, w) => s + w.allocatedBalance, 0);
    const totalSpent = bnkrWallets.reduce((s, w) => s + w.totalSpent, 0);
    const totalEarned = bnkrWallets.reduce((s, w) => s + w.totalEarned, 0);
    return { connected, total: bnkrWallets.length, totalAlloc, totalSpent, totalEarned };
  }, [bnkrWallets]);

  const deptBreakdown = useMemo(() => {
    const map: Record<string, { count: number; balance: number; spent: number }> = {};
    bnkrWallets.forEach((w) => {
      const agent = AGENTS[w.agentIndex];
      if (!agent) return;
      const dept = agent.department;
      if (!map[dept]) map[dept] = { count: 0, balance: 0, spent: 0 };
      map[dept].count++;
      map[dept].balance += w.allocatedBalance;
      map[dept].spent += w.totalSpent;
    });
    return Object.entries(map).sort((a, b) => b[1].balance - a[1].balance);
  }, [bnkrWallets]);

  const statusBg =
    connectionStatus === 'connected'
      ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]'
      : connectionStatus === 'connecting'
        ? 'bg-amber-400 shadow-[0_0_8px_#f59e0b]'
        : connectionStatus === 'error'
          ? 'bg-rose-500 shadow-[0_0_8px_#f43f5e]'
          : 'bg-slate-500';

  const statusText =
    connectionStatus === 'connected'
      ? 'Connected'
      : connectionStatus === 'connecting'
        ? 'Connecting'
        : connectionStatus === 'error'
          ? 'Error'
          : 'Awaiting';

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!bnkrMasterAddress) return;
    navigator.clipboard.writeText(bnkrMasterAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`pointer-events-auto transition-all shrink-0 ${
        !expanded
          ? 'w-auto'
          : 'w-72 sm:w-80 bg-slate-900/90 backdrop-blur-xl rounded-2xl border border-cyan-500/30 shadow-2xl overflow-hidden'
      }`}
      style={{ maxHeight: 520 }}
    >
      {/* Header / Dropdown Toggle Button */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className={`flex items-center justify-between gap-2 transition-colors ${
          !expanded
            ? 'px-3 py-2 rounded-xl border border-cyan-500/30 bg-black/60 backdrop-blur hover:bg-white/10 text-white shadow-lg'
            : 'w-full px-4 py-3 bg-slate-800/80 hover:bg-slate-800 border-b border-cyan-500/20 text-white'
        }`}
      >
        <div className="flex items-center gap-2">
          <Landmark className="text-emerald-400 shrink-0" size={15} />
          <span className="text-white font-black text-xs uppercase tracking-wider whitespace-nowrap">
            BNKR Wallets
          </span>
          <div className="flex items-center gap-1.5 ml-0.5">
            <span className={`inline-block w-2 h-2 rounded-full ${statusBg}`} />
            <span className="text-[10px] text-slate-300 font-mono hidden xs:inline">
              {stats.total > 0 ? `${stats.connected}/${stats.total}` : statusText}
            </span>
          </div>
        </div>
        {expanded ? (
          <ChevronUp size={14} className="text-slate-400 shrink-0 ml-1" />
        ) : (
          <ChevronDown size={14} className="text-slate-400 shrink-0 ml-1" />
        )}
      </button>

      {/* Expanded Drop-down Card Content */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="p-3.5 space-y-3 max-h-[440px] overflow-y-auto">
              {/* Master Wallet Address */}
              {bnkrMasterAddress ? (
                <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-xl p-2.5">
                  <div className="text-[10px] uppercase font-bold tracking-wider text-emerald-400 mb-1">
                    Master Treasury Wallet
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs text-emerald-200">
                      {bnkrMasterAddress.slice(0, 8)}…{bnkrMasterAddress.slice(-6)}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={handleCopy}
                        className="px-2 py-1 bg-white/10 hover:bg-white/20 border border-white/10 rounded text-[10px] text-slate-200 flex items-center gap-1 transition"
                      >
                        {copied ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                        <span>{copied ? 'Copied' : 'Copy'}</span>
                      </button>
                      <a
                        href={`https://basescan.org/address/${bnkrMasterAddress}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="p-1 text-cyan-400 hover:text-cyan-300 transition"
                        title="View on Basescan"
                      >
                        <ExternalLink size={13} />
                      </a>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-slate-800/60 border border-white/10 rounded-xl p-2.5 text-center">
                  <span className="text-xs text-slate-400 font-mono">
                    🏦 Awaiting master wallet provisioning...
                  </span>
                </div>
              )}

              {/* Navigation Tabs */}
              <div className="flex bg-black/40 p-1 rounded-xl border border-white/5 gap-1">
                <button
                  onClick={() => setTab('overview')}
                  className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] font-bold tracking-wide flex items-center justify-center gap-1.5 transition ${
                    tab === 'overview'
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <BarChart3 size={12} />
                  <span>Overview</span>
                </button>
                <button
                  onClick={() => setTab('agents')}
                  className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] font-bold tracking-wide flex items-center justify-center gap-1.5 transition ${
                    tab === 'agents'
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Users size={12} />
                  <span>Agents</span>
                </button>
                <button
                  onClick={() => setTab('departments')}
                  className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] font-bold tracking-wide flex items-center justify-center gap-1.5 transition ${
                    tab === 'departments'
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Building2 size={12} />
                  <span>Depts</span>
                </button>
              </div>

              {/* Tab: Overview */}
              {tab === 'overview' && (
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-white/5 border border-white/10 rounded-xl p-2.5 text-center">
                    <div className="text-[10px] text-slate-400 uppercase font-semibold">Active Agents</div>
                    <div className="text-sm font-bold text-emerald-400 font-mono mt-0.5">
                      {stats.connected}/{stats.total}
                    </div>
                  </div>
                  <div className="bg-white/5 border border-white/10 rounded-xl p-2.5 text-center">
                    <div className="text-[10px] text-slate-400 uppercase font-semibold">Total Allocated</div>
                    <div className="text-sm font-bold text-cyan-300 font-mono mt-0.5">
                      ${stats.totalAlloc.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </div>
                  </div>
                  <div className="bg-white/5 border border-white/10 rounded-xl p-2.5 text-center">
                    <div className="text-[10px] text-slate-400 uppercase font-semibold">Total Spent</div>
                    <div className="text-sm font-bold text-amber-400 font-mono mt-0.5">
                      ${stats.totalSpent.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </div>
                  </div>
                  <div className="bg-white/5 border border-white/10 rounded-xl p-2.5 text-center">
                    <div className="text-[10px] text-slate-400 uppercase font-semibold">Total Earned</div>
                    <div className="text-sm font-bold text-emerald-400 font-mono mt-0.5">
                      ${stats.totalEarned.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </div>
                  </div>
                </div>
              )}

              {/* Tab: Agents List */}
              {tab === 'agents' && (
                <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                  {bnkrWallets.length === 0 ? (
                    <div className="text-center py-4 text-xs text-slate-500 font-mono">
                      No agent wallets provisioned yet
                    </div>
                  ) : (
                    bnkrWallets.slice(0, 30).map((w) => {
                      const agent = AGENTS[w.agentIndex];
                      if (!agent) return null;
                      return (
                        <div
                          key={w.agentIndex}
                          className="flex items-center justify-between p-2 rounded-lg bg-black/30 border border-white/5 text-xs hover:border-cyan-500/30 transition"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className="font-bold text-[11px] px-1.5 py-0.5 rounded"
                              style={{ backgroundColor: `${agent.color}25`, color: agent.color }}
                            >
                              #{w.agentIndex}
                            </span>
                            <span className="text-slate-200 font-medium truncate max-w-[130px]">
                              {agent.role}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="font-mono text-cyan-300 font-semibold">
                              ${w.allocatedBalance.toFixed(0)}
                            </span>
                            <span
                              className={`w-2 h-2 rounded-full ${
                                w.status === 'connected' ? 'bg-emerald-400' : 'bg-slate-600'
                              }`}
                            />
                          </div>
                        </div>
                      );
                    })
                  )}
                  {bnkrWallets.length > 30 && (
                    <div className="text-center text-[10px] text-slate-500 py-1 font-mono">
                      +{bnkrWallets.length - 30} more agents
                    </div>
                  )}
                </div>
              )}

              {/* Tab: Departments */}
              {tab === 'departments' && (
                <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                  {deptBreakdown.length === 0 ? (
                    <div className="text-center py-4 text-xs text-slate-500 font-mono">
                      No department data available
                    </div>
                  ) : (
                    deptBreakdown.map(([dept, info]) => (
                      <div
                        key={dept}
                        className="flex items-center justify-between p-2 rounded-lg bg-black/30 border border-white/5 text-xs"
                      >
                        <div>
                          <div className="font-bold text-slate-200">{dept}</div>
                          <div className="text-[10px] text-slate-400 font-mono">{info.count} agents</div>
                        </div>
                        <div className="text-right">
                          <div className="font-mono font-semibold text-cyan-300">
                            ${info.balance.toFixed(0)}
                          </div>
                          {info.spent > 0 && (
                            <div className="text-[10px] font-mono text-amber-400/80">
                              -${info.spent.toFixed(0)}
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
