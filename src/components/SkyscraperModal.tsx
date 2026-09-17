import React from 'react';
import { useStore } from '../store/useStore';
import { motion, AnimatePresence } from 'motion/react';
import { Building2, X, DollarSign, TrendingUp, Award, Shield } from 'lucide-react';
import { getExchangeBranding } from '../three/utils/exchangeLogoMapper';

export const SkyscraperModal: React.FC = () => {
  const { boardTiles, buyTileFloor, agentBalances, userAddress } = useStore();
  const [isOpen, setIsOpen] = React.useState(false);
  const [selectedTileIdx, setSelectedTileIdx] = React.useState<number | null>(null);

  const propertyTiles = boardTiles.map((tile, idx) => ({ tile, idx })).filter(t => t.tile.type === 'property');
  const selectedTileData = selectedTileIdx !== null ? boardTiles[selectedTileIdx] : null;
  const branding = selectedTileData ? getExchangeBranding(selectedTileData) : null;
  const currentFloors = selectedTileData?.floors || 0;
  const floorCost = 150 * (currentFloors + 1);

  return (
    <>
      {/* Floating button to open Skyscraper Floor Manager */}
      <div className="fixed top-20 right-[16rem] sm:right-[26rem] z-[130] pointer-events-auto">
        <button
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-2 px-3.5 py-2.5 rounded-2xl bg-slate-900/90 border border-cyan-500/40 text-cyan-400 hover:bg-slate-800 transition-all shadow-xl shadow-cyan-500/10 backdrop-blur-xl font-bold text-xs"
        >
          <Building2 size={18} className="text-cyan-400" />
          <span>Skyscraper Hub</span>
        </button>
      </div>

      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xl pointer-events-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="w-full max-w-3xl bg-slate-900 border border-cyan-500/30 rounded-3xl shadow-2xl overflow-hidden text-white flex flex-col max-h-[90vh]"
            >
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-white/10 bg-slate-950/50">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
                    <Building2 size={26} />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold tracking-tight text-cyan-300">Skyscraper Floor Upgrades & Realty</h2>
                    <p className="text-xs text-slate-400">Grow profitable board exchanges into towering skyscrapers and collect high yields</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-slate-300 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Body */}
              <div className="p-6 overflow-y-auto space-y-6">
                {/* Tile Selector */}
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-2">SELECT PROFITABLE EXCHANGE BOARD</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 max-h-48 overflow-y-auto pr-1">
                    {propertyTiles.map(({ tile, idx }) => {
                      const b = getExchangeBranding(tile);
                      const isSelected = selectedTileIdx === idx;
                      return (
                        <button
                          key={tile.id}
                          onClick={() => setSelectedTileIdx(idx)}
                          className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between ${
                            isSelected 
                              ? 'bg-cyan-500/20 border-cyan-500 text-white' 
                              : 'bg-white/5 border-white/10 hover:border-white/20 text-slate-300'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-lg">{b.iconSymbol}</span>
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300">
                              {tile.floors || 0} Flr
                            </span>
                          </div>
                          <div className="font-bold text-xs truncate">{tile.name}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Selected Tile Detail & Upgrade Panel */}
                {selectedTileData && branding ? (
                  <div className="p-5 rounded-2xl bg-slate-950/60 border border-cyan-500/30 flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-4xl shadow-inner">
                        {branding.iconSymbol}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-bold px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300">
                            {branding.ticker}
                          </span>
                          <span className="text-xs text-slate-400">Score: {selectedTileData.volumeScore ?? 50}</span>
                        </div>
                        <h3 className="text-lg font-bold text-white">{selectedTileData.name}</h3>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Current Skyscraper Height: <span className="text-cyan-400 font-bold">{currentFloors + 1} Floors</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-2 w-full md:w-auto">
                      <div className="text-right">
                        <div className="text-xs text-slate-400">Upgrade Cost</div>
                        <div className="text-base font-mono font-bold text-amber-400">${floorCost} VAL</div>
                      </div>
                      <button
                        onClick={() => {
                          if (selectedTileIdx !== null) {
                            buyTileFloor(selectedTileIdx, 0); // Buy as CEO/Player (index 0)
                          }
                        }}
                        className="w-full md:w-auto px-6 py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition-all shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-2"
                      >
                        <Building2 size={16} />
                        <span>Build Floor (+1 Skyscraper)</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="p-8 text-center text-slate-400 bg-white/5 rounded-2xl border border-white/10">
                    <Building2 size={32} className="mx-auto mb-2 text-slate-500" />
                    <p className="text-sm">Select an exchange tile above to manage and construct skyscraper floors.</p>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};
