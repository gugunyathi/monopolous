
import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import { AGENTS } from '../data/agents';
import { Trophy, Wallet, ChevronUp, ChevronDown, Zap, X, Check, Copy, LogIn, TrendingUp, TrendingDown, Target, Flame, BarChart2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { BasePayButton } from '@base-org/account-ui/react';
import { signInWithBase } from '../services/baseAccountService';

// Deterministic stats derived from agent index + riskLevel
function agentWinRate(index: number, risk: string): number {
  const base: Record<string, number> = { Low: 69, Medium: 59, High: 50, Degen: 40 };
  return Math.min(94, Math.max(22, (base[risk] ?? 55) + (index % 17) - 8));
}
function agentTradeCount(index: number): number {
  return 12 + (index % 89);
}
const RISK_COLOR: Record<string, string> = {
  Low: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  Medium: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
  High: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
  Degen: 'text-red-400 bg-red-500/10 border-red-500/20',
};

const PRESET_AMOUNTS = [1, 5, 10, 50];

const Leaderboard: React.FC = () => {
  const { leaderboard, agentBalances, viewMode, updateBalance, updateLeaderboard, userAddress, setUserAddress } = useStore();
  // Collapse by default on mobile screens to avoid blocking the 3D world
  const [collapsed, setCollapsed] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768);
  const [fundingIndex, setFundingIndex] = useState<number | null>(null);
  const [selectedAmount, setSelectedAmount] = useState<number>(5);
  const [payState, setPayState] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [copied, setCopied] = useState(false);
  const [signingIn, setSigningIn] = useState(false);

  if (viewMode !== 'world') return null;

  const fundingAgent = fundingIndex !== null ? AGENTS[fundingIndex] : null;

  function openFund(agentIndex: number) {
    setFundingIndex(agentIndex);
    setSelectedAmount(5);
    setPayState('idle');
    setErrorMsg('');
  }

  function close() {
    setFundingIndex(null);
    setPayState('idle');
  }

  async function handleSignIn() {
    setSigningIn(true);
    try {
      const { address } = await signInWithBase();
      setUserAddress(address);
    } catch {
      // user cancelled
    } finally {
      setSigningIn(false);
    }
  }

  function copyAddress() {
    if (!fundingAgent) return;
    navigator.clipboard.writeText(fundingAgent.wallet.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handlePaymentResult(result: { success: boolean; transactionHash?: string; error?: string }) {
    if (result.success && fundingIndex !== null) {
      updateBalance(fundingIndex, selectedAmount);
      updateLeaderboard();
      setPayState('success');
      setTimeout(close, 2500);
    } else {
      setPayState('error');
      setErrorMsg(result.error ?? 'Payment failed');
    }
  }

  const amountStr = selectedAmount.toFixed(2); // "5.00" format required by BasePayButton

  return (
    <>
      <motion.div
        initial={{ x: 300, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        className="fixed top-16 sm:top-20 md:top-24 right-3 sm:right-4 md:right-8 w-48 sm:w-56 md:w-64 bg-white/10 backdrop-blur-xl rounded-2xl border border-white/10 z-[100] pointer-events-auto overflow-hidden max-h-[80vh]"
      >
        {/* Header */}
        <button
          onClick={() => setCollapsed(c => !c)}
          className="w-full flex items-center justify-between px-3 md:px-4 py-3 md:py-4 hover:bg-white/5 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Trophy className="text-yellow-500" size={16} />
            <h3 className="text-white font-black text-[10px] md:text-xs uppercase tracking-widest">Top Traders</h3>
          </div>
          {collapsed
            ? <ChevronDown size={12} className="text-white/40" />
            : <ChevronUp size={12} className="text-white/40" />
          }
        </button>

        <AnimatePresence initial={false}>
          {!collapsed && (
            <motion.div
              key="body"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeInOut' }}
              className="overflow-hidden"
            >
              <div className="px-3 md:px-4 pb-3 md:pb-4 space-y-2 md:space-y-3 overflow-y-auto max-h-[50vh]">
                {leaderboard.map((entry, i) => {
                  const agent = AGENTS[entry.agentIndex];
                  const startBal = agent.wallet.balance;
                  const pnl = entry.netWorth - startBal;
                  const pnlPct = ((pnl / startBal) * 100).toFixed(1);
                  const isProfit = pnl >= 0;
                  return (
                    <button
                      key={entry.agentIndex}
                      onClick={() => openFund(entry.agentIndex)}
                      className="w-full flex items-center justify-between group rounded-xl px-2 py-1.5 -mx-2 hover:bg-white/5 active:bg-white/10 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[10px] font-black text-white/40 w-4 shrink-0">{i + 1}</span>
                        <div
                          className="w-6 h-6 rounded-full flex items-center justify-center text-[8px] font-black text-white border border-white/10 shrink-0"
                          style={{ backgroundColor: agent.color }}
                        >
                          {agent.role[0]}
                        </div>
                        <div className="text-left min-w-0">
                          <p className="text-white text-[9px] md:text-[10px] font-bold truncate w-16 md:w-20">@{agent.role.replace(/\s+/g, '').toLowerCase()}</p>
                          <p className="text-white/40 text-[7px] md:text-[8px] uppercase tracking-widest truncate">{agent.department}</p>
                          <p className="text-blue-400/50 text-[6px] md:text-[7px] font-mono">{agent.wallet.address.slice(0, 6)}…{agent.wallet.address.slice(-4)}</p>
                        </div>
                      </div>
                      {/* PnL % column */}
                      <div className="flex flex-col items-center shrink-0 mx-1.5">
                        <span className={`text-[8px] md:text-[9px] font-black tabular-nums ${isProfit ? 'text-emerald-400' : 'text-red-400'}`}>
                          {isProfit ? '+' : ''}{pnlPct}%
                        </span>
                        <span className={`text-[6px] font-black uppercase tracking-widest ${isProfit ? 'text-emerald-600' : 'text-red-600'}`}>
                          PnL
                        </span>
                      </div>
                      {/* Net worth + fund */}
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <p className="text-white text-[9px] md:text-[10px] font-black">${entry.netWorth.toLocaleString()}</p>
                        <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[7px] font-black uppercase tracking-widest transition-all bg-white/5 text-white/30 group-hover:bg-blue-500/20 group-hover:text-blue-300">
                          <Zap size={7} /> Fund
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="px-3 md:px-4 pb-3 md:pb-4 pt-0 border-t border-white/10">
                <div className="flex items-center justify-between text-white/60 pt-3 md:pt-4">
                  <div className="flex items-center gap-1">
                    <Wallet size={10} className="md:w-3 md:h-3" />
                    <span className="text-[7px] md:text-[8px] font-black uppercase tracking-widest">
                      {userAddress ? `${userAddress.slice(0, 6)}…${userAddress.slice(-4)}` : 'Not connected'}
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Fund Agent Modal */}
      <AnimatePresence>
        {fundingAgent && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 pointer-events-auto"
            onClick={(e) => { if (e.target === e.currentTarget) close(); }}
          >
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div
              initial={{ scale: 0.92, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.92, opacity: 0, y: 20 }}
              transition={{ type: 'spring', damping: 22, stiffness: 300 }}
              className="relative w-full max-w-sm bg-zinc-900 rounded-3xl border border-white/10 shadow-2xl overflow-hidden overflow-y-auto max-h-[90vh]"
            >
              {/* Accent bar */}
              <div className="h-1 w-full" style={{ backgroundColor: fundingAgent.color }} />

              {/* Header */}
              <div className="flex items-start justify-between p-5 pb-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-0.5">Fund Agent</p>
                  <h2 className="text-lg font-black text-white leading-tight">{fundingAgent.role}</h2>
                  <p className="text-[10px] text-zinc-500 uppercase tracking-widest">{fundingAgent.department}</p>
                </div>
                <button onClick={close} className="p-1.5 rounded-full hover:bg-white/10 text-zinc-500 hover:text-white transition-colors">
                  <X size={14} />
                </button>
              </div>

              {/* ── Agent Summary ── */}
              {(() => {
                const lbEntry = leaderboard.find(e => e.agentIndex === fundingIndex);
                const startBal = fundingAgent.wallet.balance;
                const liveBal = agentBalances[fundingIndex!] ?? startBal;
                const netWorth = lbEntry ? lbEntry.netWorth : liveBal;
                const pnl = netWorth - startBal;
                const pnlPct = ((pnl / startBal) * 100).toFixed(1);
                const isProfit = pnl >= 0;
                const winRate = agentWinRate(fundingAgent.index, fundingAgent.riskLevel);
                const trades = agentTradeCount(fundingAgent.index);
                return (
                  <div className="mx-5 mb-4 rounded-2xl border border-white/5 overflow-hidden">
                    {/* PnL banner */}
                    <div className={`flex items-center justify-between px-3 py-2.5 ${isProfit ? 'bg-emerald-500/10' : 'bg-red-500/10'}`}>
                      <div className="flex items-center gap-1.5">
                        {isProfit
                          ? <TrendingUp size={13} className="text-emerald-400" />
                          : <TrendingDown size={13} className="text-red-400" />}
                        <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Net Worth</span>
                      </div>
                      <div className="text-right">
                        <p className={`text-sm font-black ${isProfit ? 'text-emerald-400' : 'text-red-400'}`}>
                          ${netWorth.toLocaleString()}
                        </p>
                        <p className={`text-[9px] font-bold ${isProfit ? 'text-emerald-500/80' : 'text-red-500/80'}`}>
                          {isProfit ? '+' : ''}{pnl >= 0 ? '+' : ''}${pnl.toLocaleString(undefined, { maximumFractionDigits: 0 })} ({isProfit ? '+' : ''}{pnlPct}%)
                        </p>
                      </div>
                    </div>

                    {/* Stats row */}
                    <div className="grid grid-cols-3 divide-x divide-white/5 bg-white/3">
                      <div className="flex flex-col items-center py-2.5 gap-0.5">
                        <div className="flex items-center gap-1">
                          <Target size={9} className="text-blue-400" />
                          <span className="text-[8px] font-black uppercase tracking-widest text-zinc-500">Win Rate</span>
                        </div>
                        <p className="text-[13px] font-black text-white">{winRate}%</p>
                      </div>
                      <div className="flex flex-col items-center py-2.5 gap-0.5">
                        <div className="flex items-center gap-1">
                          <BarChart2 size={9} className="text-purple-400" />
                          <span className="text-[8px] font-black uppercase tracking-widest text-zinc-500">Trades</span>
                        </div>
                        <p className="text-[13px] font-black text-white">{trades}</p>
                      </div>
                      <div className="flex flex-col items-center py-2.5 gap-0.5">
                        <div className="flex items-center gap-1">
                          <Flame size={9} className="text-orange-400" />
                          <span className="text-[8px] font-black uppercase tracking-widest text-zinc-500">Risk</span>
                        </div>
                        <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full border ${RISK_COLOR[fundingAgent.riskLevel]}`}>
                          {fundingAgent.riskLevel}
                        </span>
                      </div>
                    </div>

                    {/* Style + tokens */}
                    <div className="px-3 py-2.5 border-t border-white/5 space-y-1.5">
                      <div className="flex items-start gap-2">
                        <span className="text-[8px] font-black uppercase tracking-widest text-zinc-600 mt-0.5 shrink-0">Style</span>
                        <span className="text-[9px] text-zinc-300 font-medium">{fundingAgent.tradingStyle} · {fundingAgent.traderPersonality}</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="text-[8px] font-black uppercase tracking-widest text-zinc-600 mt-0.5 shrink-0">Focus</span>
                        <div className="flex flex-wrap gap-1">
                          {fundingAgent.preferredTokens.map(t => (
                            <span key={t} className="text-[8px] font-black bg-blue-500/10 text-blue-300 border border-blue-500/20 px-1.5 py-0.5 rounded-full">{t}</span>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="text-[8px] font-black uppercase tracking-widest text-zinc-600 mt-0.5 shrink-0">Task</span>
                        <span className="text-[9px] text-zinc-400 leading-relaxed line-clamp-2">{fundingAgent.mission}</span>
                      </div>
                    </div>

                    {/* Expertise chips */}
                    <div className="px-3 pb-3 flex flex-wrap gap-1">
                      {fundingAgent.expertise.map(e => (
                        <span key={e} className="text-[7px] font-black bg-white/5 text-zinc-400 border border-white/5 px-1.5 py-0.5 rounded-full">{e}</span>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* Recipient wallet address */}
              <div className="mx-5 mb-4 flex items-center justify-between bg-white/5 rounded-xl px-3 py-2 border border-white/5">
                <div>
                  <p className="text-[8px] font-black uppercase tracking-widest text-zinc-600 mb-0.5">Recipient (Base)</p>
                  <code className="text-[10px] font-mono text-blue-400">
                    {fundingAgent.wallet.address.slice(0, 10)}…{fundingAgent.wallet.address.slice(-6)}
                  </code>
                </div>
                <button onClick={copyAddress} className="ml-2 text-zinc-500 hover:text-white transition-colors shrink-0">
                  {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                </button>
              </div>

              {/* Preset amounts */}
              <div className="px-5 mb-4">
                <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-2">Amount (USDC)</p>
                <div className="grid grid-cols-4 gap-2">
                  {PRESET_AMOUNTS.map((amt) => (
                    <button
                      key={amt}
                      onClick={() => { setSelectedAmount(amt); setPayState('idle'); }}
                      className={`py-2.5 rounded-xl text-sm font-black transition-all border ${
                        selectedAmount === amt
                          ? 'bg-blue-500 text-white border-blue-400 shadow-lg shadow-blue-500/30'
                          : 'bg-white/5 text-zinc-400 border-white/5 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      ${amt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Payment area */}
              <div className="px-5 pb-5">
                {payState === 'success' ? (
                  <div className="flex flex-col items-center gap-2 py-4">
                    <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                      <Check size={20} className="text-emerald-400" />
                    </div>
                    <p className="text-white font-black text-sm">Payment sent!</p>
                    <p className="text-zinc-500 text-[10px]">${selectedAmount} USDC → {fundingAgent.role}</p>
                  </div>
                ) : payState === 'error' ? (
                  <div className="mb-3">
                    <p className="text-red-400 text-[10px] font-bold text-center mb-3">{errorMsg}</p>
                    <button
                      onClick={() => setPayState('idle')}
                      className="w-full py-2.5 rounded-xl bg-white/5 text-zinc-400 text-xs font-black uppercase tracking-widest hover:bg-white/10 transition-colors"
                    >
                      Try Again
                    </button>
                  </div>
                ) : !userAddress ? (
                  /* Not signed in — prompt connect */
                  <div className="flex flex-col gap-2">
                    <p className="text-center text-[10px] text-zinc-500 mb-1">Connect your wallet to send USDC</p>
                    <button
                      onClick={handleSignIn}
                      disabled={signingIn}
                      className="w-full py-3.5 rounded-2xl font-black text-sm uppercase tracking-widest text-white bg-blue-500 hover:bg-blue-400 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-60"
                    >
                      <LogIn size={15} />
                      {signingIn ? 'Connecting…' : 'Connect Wallet'}
                    </button>
                  </div>
                ) : (
                  /* Signed in — show BasePayButton */
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between text-[9px] text-zinc-600 mb-1">
                      <span>From: <code className="font-mono text-zinc-400">{userAddress.slice(0, 6)}…{userAddress.slice(-4)}</code></span>
                      <span className="text-blue-400 font-black">Base Mainnet</span>
                    </div>
                    {/* BasePayButton handles the full wallet UX: sign → broadcast → confirm */}
                    <BasePayButton
                      paymentOptions={{
                        amount: amountStr,
                        to: fundingAgent.wallet.address,
                        testnet: false,
                      }}
                      colorScheme="dark"
                      size="large"
                      variant="solid"
                      onPaymentResult={handlePaymentResult}
                    />
                    <p className="text-center text-[9px] text-zinc-600 mt-1">
                      Sends ${selectedAmount} USDC on Base via your connected wallet
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default Leaderboard;
