import React from 'react';
import { useStore } from '../store/useStore';
import { motion, AnimatePresence } from 'motion/react';
import { Flame, TrendingUp, Activity, X, Smartphone, Zap } from 'lucide-react';

export const HeatmapLegend: React.FC = () => {
  const { isHeatmapMode, toggleHeatmapMode, boardTiles, viewMode, mobileOptimizationMode, toggleMobileOptimization } = useStore();

  if (!isHeatmapMode || viewMode !== 'world') return null;

  // Find top volume tiles
  const exchangeTiles = boardTiles
    .filter(t => t.volumeScore !== undefined)
    .sort((a, b) => (b.volumeScore ?? 0) - (a.volumeScore ?? 0))
    .slice(0, 6);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.95 }}
        className="fixed top-20 sm:top-24 left-4 sm:left-6 w-80 max-w-[calc(100vw-2rem)] bg-slate-950/85 backdrop-blur-2xl border border-amber-500/30 rounded-2xl shadow-2xl shadow-amber-500/10 p-4 text-white z-[120] pointer-events-auto"
      >
        <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <Flame size={18} className="animate-pulse" />
            </div>
            <div>
              <h3 className="font-bold text-sm tracking-wide text-amber-300">Volume & Volatility Heatmap</h3>
              <p className="text-[11px] text-slate-400">Real-time exchange & DEX liquidity flow</p>
            </div>
          </div>
          <button
            onClick={toggleHeatmapMode}
            className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-slate-300 transition-colors"
            title="Close Heatmap"
          >
            <X size={14} />
          </button>
        </div>

        {/* Intensity Gradient Bar */}
        <div className="mb-3">
          <div className="flex justify-between text-[10px] text-slate-400 mb-1 font-medium">
            <span>Low Vol (Cool Blue)</span>
            <span>Mid Vol (Amber)</span>
            <span>Extreme Vol (Fiery Red)</span>
          </div>
          <div className="h-2.5 w-full rounded-full bg-gradient-to-r from-cyan-500 via-amber-500 to-red-500 p-0.5 shadow-inner">
            <div className="w-full h-full rounded-full bg-black/20" />
          </div>
        </div>

        {/* Mobile GPU Performance Toggle */}
        <div className="mb-3 bg-white/5 border border-white/10 rounded-xl p-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Smartphone size={15} className={mobileOptimizationMode ? 'text-emerald-400' : 'text-slate-400'} />
            <div>
              <div className="text-xs font-semibold text-slate-200">Mobile GPU Performance</div>
              <div className="text-[10px] text-slate-400">
                {mobileOptimizationMode ? '256px Textures / Low Complexity' : '512px HD Textures / Standard'}
              </div>
            </div>
          </div>
          <button
            onClick={toggleMobileOptimization}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all flex items-center gap-1 ${
              mobileOptimizationMode
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                : 'bg-white/10 text-slate-300 hover:bg-white/20 border border-white/10'
            }`}
          >
            <Zap size={12} className={mobileOptimizationMode ? 'text-emerald-400' : ''} />
            <span>{mobileOptimizationMode ? 'Optimized' : 'Standard'}</span>
          </button>
        </div>

        {/* Top Active Exchanges */}
        <div className="space-y-2">
          <div className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
            <TrendingUp size={13} className="text-amber-400" />
            <span>Top Volatile Exchanges / Markets</span>
          </div>
          <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
            {exchangeTiles.map((tile) => {
              const score = tile.volumeScore ?? 50;
              const badgeColor = score >= 90 ? 'bg-red-500/20 text-red-300 border-red-500/40' : score >= 75 ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' : 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40';
              return (
                <div key={tile.id} className="flex items-center justify-between bg-white/5 hover:bg-white/10 rounded-xl px-3 py-2 border border-white/5 transition-all text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white">{tile.name}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${badgeColor}`}>
                      {tile.volatility || 'High'}
                    </span>
                  </div>
                  <div className="text-right">
                    <div className="font-mono font-semibold text-amber-300">{tile.volume24h || '$1B'}</div>
                    <div className="text-[10px] text-slate-400">Score {score}/100</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-3 pt-3 border-t border-white/10 text-[11px] text-slate-400 flex items-center gap-1.5">
          <Activity size={12} className="text-emerald-400" />
          <span>Agents dynamically prioritize high-yield liquidity pools.</span>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
