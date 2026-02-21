
import React from 'react';
import { useStore } from '../store/useStore';
import { AGENTS } from '../data/agents';
import { Trophy, TrendingUp, Wallet } from 'lucide-react';
import { motion } from 'motion/react';

const Leaderboard: React.FC = () => {
  const { leaderboard, agentBalances, viewMode } = useStore();

  if (viewMode !== 'world') return null;

  return (
    <motion.div 
      initial={{ x: 300, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      className="fixed top-24 right-8 w-64 bg-white/10 backdrop-blur-xl rounded-2xl border border-white/10 p-4 z-[100] pointer-events-auto"
    >
      <div className="flex items-center gap-2 mb-4">
        <Trophy className="text-yellow-500" size={18} />
        <h3 className="text-white font-black text-xs uppercase tracking-widest">Top Traders</h3>
      </div>

      <div className="space-y-3">
        {leaderboard.map((entry, i) => {
          const agent = AGENTS[entry.agentIndex];
          return (
            <div key={entry.agentIndex} className="flex items-center justify-between group">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black text-white/40 w-4">{i + 1}</span>
                <div 
                  className="w-6 h-6 rounded-full flex items-center justify-center text-[8px] font-black text-white border border-white/10"
                  style={{ backgroundColor: agent.color }}
                >
                  {agent.role[0]}
                </div>
                <div>
                  <p className="text-white text-[10px] font-bold truncate w-24">@{agent.role.replace(/\s+/g, '').toLowerCase()}</p>
                  <p className="text-white/40 text-[8px] uppercase tracking-widest">{agent.department}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-emerald-400 text-[10px] font-black">${entry.netWorth.toLocaleString()}</p>
                <div className="flex items-center justify-end gap-1">
                  <TrendingUp size={8} className="text-emerald-500" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 pt-4 border-t border-white/10">
        <div className="flex items-center justify-between text-white/60">
          <div className="flex items-center gap-1">
            <Wallet size={12} />
            <span className="text-[8px] font-black uppercase tracking-widest">Your Balance</span>
          </div>
          <span className="text-xs font-black text-white">$1,500</span>
        </div>
      </div>
    </motion.div>
  );
};

export default Leaderboard;
