/**
 * TokenLaunchesPanel
 *
 * Displays tokens deployed by AI agents via BankrBot.
 * Shows token name, symbol, address, deployer, chain, and time.
 * Appears as a floating panel accessible from the social feed area.
 */

import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import { AGENTS } from '../data/agents';
import { getLaunchedTokens, ceoClaimFees, ceoCheckFees } from '../services/tokenLaunchService';
import { isBankrBotAvailable } from '../services/bankrBotService';
import {
  Rocket, ExternalLink, Copy, CheckCheck, Coins, RefreshCw,
  Clock, User, ChevronDown, ChevronUp, Zap,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const TokenLaunchesPanel: React.FC = () => {
  const { launchedTokens, viewMode } = useStore();
  const [expanded, setExpanded] = useState(false);
  const [copiedAddr, setCopiedAddr] = useState<string | null>(null);
  const [claimingFees, setClaimingFees] = useState<string | null>(null);
  const [feeStatus, setFeeStatus] = useState<Record<string, string>>({});

  // Only show when in social or posts mode and we have tokens
  if (viewMode !== 'social' && viewMode !== 'posts') return null;

  const bankrAvailable = isBankrBotAvailable();

  // Combine store tokens with service tokens
  const serviceTokens = getLaunchedTokens();
  const allTokens = [
    ...launchedTokens,
    ...serviceTokens.filter(
      (st) => !launchedTokens.some((lt) => lt.tokenAddress === st.tokenAddress),
    ).map((st) => ({
      tokenName: st.tokenName,
      tokenSymbol: st.tokenSymbol,
      tokenAddress: st.tokenAddress,
      chain: st.chain,
      deployerAgentIndex: st.deployerAgentIndex,
      deployedAt: st.deployedAt,
    })),
  ];

  if (allTokens.length === 0 && !bankrAvailable) return null;

  const copyAddress = (addr: string) => {
    navigator.clipboard.writeText(addr);
    setCopiedAddr(addr);
    setTimeout(() => setCopiedAddr(null), 2000);
  };

  const handleCheckFees = async (tokenName: string) => {
    setClaimingFees(tokenName);
    try {
      const result = await ceoCheckFees(tokenName);
      if (result?.response) {
        setFeeStatus((prev) => ({ ...prev, [tokenName]: result.response! }));
      }
    } catch {
      setFeeStatus((prev) => ({ ...prev, [tokenName]: 'Failed to check fees' }));
    }
    setClaimingFees(null);
  };

  const handleClaimFees = async (tokenName: string) => {
    setClaimingFees(tokenName);
    try {
      const result = await ceoClaimFees(tokenName);
      if (result?.response) {
        setFeeStatus((prev) => ({ ...prev, [tokenName]: `Claimed! ${result.response}` }));
      }
    } catch {
      setFeeStatus((prev) => ({ ...prev, [tokenName]: 'Claim failed' }));
    }
    setClaimingFees(null);
  };

  const timeAgo = (ts: number) => {
    const diff = Date.now() - ts;
    if (diff < 60_000) return 'just now';
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
    return `${Math.floor(diff / 86_400_000)}d ago`;
  };

  return (
    <div className="pointer-events-auto">
      {/* Toggle Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-3 py-2 bg-gradient-to-r from-pink-500/20 to-purple-500/20 backdrop-blur-xl rounded-xl border border-pink-500/20 hover:border-pink-500/40 transition-all group"
      >
        <div className="flex items-center gap-2">
          <Rocket size={14} className="text-pink-400" />
          <span className="text-xs font-bold text-white/90 uppercase tracking-wider">
            Token Launches
          </span>
          {allTokens.length > 0 && (
            <span className="bg-pink-500/30 text-pink-300 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
              {allTokens.length}
            </span>
          )}
          {bankrAvailable && (
            <span className="bg-emerald-500/20 text-emerald-400 text-[9px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-1">
              <Zap size={8} /> LIVE
            </span>
          )}
        </div>
        {expanded ? <ChevronUp size={14} className="text-white/50" /> : <ChevronDown size={14} className="text-white/50" />}
      </button>

      {/* Expanded Token List */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-2 space-y-2 max-h-[300px] overflow-y-auto pr-1 scrollbar-thin">
              {allTokens.length === 0 ? (
                <div className="text-center py-6 text-white/40 text-xs">
                  <Rocket size={24} className="mx-auto mb-2 opacity-40" />
                  <p>No tokens launched yet</p>
                  <p className="text-[10px] mt-1">AI agents will deploy tokens autonomously via BankrBot</p>
                </div>
              ) : (
                allTokens.map((token, i) => {
                  const deployer = AGENTS[token.deployerAgentIndex];
                  return (
                    <motion.div
                      key={token.tokenAddress || i}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="bg-white/5 backdrop-blur-lg rounded-xl border border-white/10 p-3 hover:border-pink-500/30 transition-all"
                    >
                      {/* Token Header */}
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center text-white font-black text-xs">
                            ${token.tokenSymbol?.slice(0, 2) ?? '??'}
                          </div>
                          <div>
                            <div className="text-sm font-bold text-white flex items-center gap-1">
                              ${token.tokenSymbol}
                              <span className="text-[10px] font-normal text-white/40">{token.tokenName}</span>
                            </div>
                            <div className="flex items-center gap-1 text-[10px] text-white/40">
                              <Clock size={8} />
                              {timeAgo(token.deployedAt)}
                              <span className="mx-0.5">•</span>
                              <span className="uppercase">{token.chain}</span>
                            </div>
                          </div>
                        </div>

                        {/* Copy Address */}
                        {token.tokenAddress && (
                          <button
                            onClick={() => copyAddress(token.tokenAddress)}
                            className="text-white/30 hover:text-white/70 transition-colors p-1"
                            title="Copy token address"
                          >
                            {copiedAddr === token.tokenAddress ? (
                              <CheckCheck size={12} className="text-emerald-400" />
                            ) : (
                              <Copy size={12} />
                            )}
                          </button>
                        )}
                      </div>

                      {/* Address */}
                      {token.tokenAddress && (
                        <div className="mt-1.5 flex items-center gap-1">
                          <code className="text-[10px] text-white/30 font-mono">
                            {token.tokenAddress.slice(0, 10)}…{token.tokenAddress.slice(-6)}
                          </code>
                          <a
                            href={`https://basescan.org/token/${token.tokenAddress}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-white/30 hover:text-blue-400 transition-colors"
                          >
                            <ExternalLink size={10} />
                          </a>
                        </div>
                      )}

                      {/* Deployer */}
                      {deployer && (
                        <div className="mt-1.5 flex items-center gap-1 text-[10px] text-white/40">
                          <User size={9} />
                          <span style={{ color: deployer.color }}>
                            @{deployer.role.replace(/\s+/g, '').toLowerCase()}
                          </span>
                          <span className="text-white/20">•</span>
                          <span>{deployer.department}</span>
                        </div>
                      )}

                      {/* Fee Actions (CEO only) */}
                      {bankrAvailable && (
                        <div className="mt-2 flex items-center gap-1.5">
                          <button
                            onClick={() => handleCheckFees(token.tokenName)}
                            disabled={claimingFees === token.tokenName}
                            className="flex items-center gap-1 text-[10px] bg-white/5 hover:bg-white/10 text-white/50 hover:text-white/80 px-2 py-1 rounded-lg transition-all disabled:opacity-40"
                          >
                            <RefreshCw size={9} className={claimingFees === token.tokenName ? 'animate-spin' : ''} />
                            Check Fees
                          </button>
                          <button
                            onClick={() => handleClaimFees(token.tokenName)}
                            disabled={claimingFees === token.tokenName}
                            className="flex items-center gap-1 text-[10px] bg-pink-500/10 hover:bg-pink-500/20 text-pink-400 hover:text-pink-300 px-2 py-1 rounded-lg transition-all disabled:opacity-40"
                          >
                            <Coins size={9} />
                            Claim Fees
                          </button>
                        </div>
                      )}

                      {/* Fee Status */}
                      {feeStatus[token.tokenName] && (
                        <div className="mt-1.5 text-[10px] text-emerald-400/70 bg-emerald-500/10 rounded-lg px-2 py-1">
                          {feeStatus[token.tokenName]}
                        </div>
                      )}
                    </motion.div>
                  );
                })
              )}
            </div>

            {/* BankrBot Status Footer */}
            <div className="mt-2 flex items-center justify-center gap-2 text-[10px] text-white/30">
              <div className={`w-1.5 h-1.5 rounded-full ${bankrAvailable ? 'bg-emerald-400 animate-pulse' : 'bg-red-500'}`} />
              <span>
                BankrBot {bankrAvailable ? 'Connected' : 'Unavailable'} • Base Network
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default TokenLaunchesPanel;
