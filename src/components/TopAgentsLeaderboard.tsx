import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import { AGENTS } from '../data/agents';
import { Trophy, Eye, ChevronDown, ChevronUp, TrendingUp } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const TopAgentsLeaderboard: React.FC = () => {
  const { agentBalances, boardTiles, setSelectedNpc, selectedNpcIndex, viewMode } = useStore();
  const [collapsed, setCollapsed] = useState(false);

  if (viewMode !== 'world') return null;

  // Compute top 5 performing agents
  const topAgents = AGENTS.map((agent, index) => {
    const bal = agentBalances[index] ?? agent.wallet.balance;
    const propertiesValue = boardTiles
      .filter(t => t.ownerIndex === index)
      .reduce((sum, t) => sum + (t.price || 0), 0);
    return {
      agentIndex: index,
      agent,
      netWorth: bal + propertiesValue,
    };
  })
    .sort((a, b) => b.netWorth - a.netWorth)
    .slice(0, 5);

  return (
    <motion.div
      initial={{ x: -300, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      className="fixed top-20 left-4 sm:left-6 z-[120] pointer-events-auto w-64 sm:w-72 bg-slate-900/90 backdrop-blur-xl rounded-2xl border border-cyan-500/30 shadow-2xl overflow-hidden"
    >
      {/* Header */}
      <button
        onClick={() => setCollapsed(c => !c)}
        className="w-full flex items-center justify-between px-4 py-3 bg-slate-800/80 hover:bg-slate-800 transition-colors border-b border-cyan-500/20"
      >
        <div className="flex items-center gap-2">
          <Trophy className="text-amber-400 animate-pulse" size={16} />
          <h3 className="text-white font-black text-xs uppercase tracking-wider">Top Performing Agents</h3>
        </div>
        {collapsed ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronUp size={14} className="text-slate-400" />}
      </button>

      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="p-3 space-y-2 max-h-[60vh] overflow-y-auto">
              {topAgents.map((item, index) => {
                const { agentIndex, agent, netWorth } = item;
                const isSelected = selectedNpcIndex === agentIndex;
                const rankColor =
                  index === 0 ? 'text-amber-400 bg-amber-500/20 border-amber-500/40' :
                  index === 1 ? 'text-slate-300 bg-slate-500/20 border-slate-500/40' :
                  index === 2 ? 'text-amber-600 bg-amber-700/20 border-amber-600/40' :
                  'text-slate-400 bg-slate-800 border-slate-700';

                return (
                  <div
                    key={agentIndex}
                    className={`flex items-center justify-between p-2 rounded-xl border transition-all ${
                      isSelected
                        ? 'bg-cyan-500/20 border-cyan-400 shadow-md shadow-cyan-500/20'
                        : 'bg-slate-800/50 border-slate-700/50 hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {/* Rank badge */}
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black border shrink-0 ${rankColor}`}>
                        {index + 1}
                      </span>

                      {/* Character Avatar */}
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-black text-white border border-white/20 shadow-sm shrink-0"
                        style={{ backgroundColor: agent.color }}
                      >
                        {agent.role[0]}
                      </div>

                      {/* Details */}
                      <div className="min-w-0 text-left">
                        <p className="text-white text-xs font-bold truncate">
                          @{agent.role.replace(/\s+/g, '').toLowerCase()}
                        </p>
                        <p className="text-cyan-300 text-[10px] font-black tracking-wide">
                          ${netWorth >= 1_000_000 ? `${(netWorth / 1_000_000).toFixed(2)}M` : netWorth.toLocaleString()}
                        </p>
                      </div>
                    </div>

                    {/* Inspect Button */}
                    <button
                      onClick={() => setSelectedNpc(agentIndex)}
                      className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 ${
                        isSelected
                          ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/40'
                          : 'bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20 border border-cyan-500/30'
                      }`}
                      title={`Focus camera on ${agent.role}`}
                    >
                      <Eye size={13} />
                      <span>Inspect</span>
                    </button>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
