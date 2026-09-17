import React from 'react';
import { useStore } from '../store/useStore';
import { motion, AnimatePresence } from 'motion/react';
import { Car, Ship, Zap, Crown, Shield, X, Check, DollarSign } from 'lucide-react';

export const PhysicalCharactersModal: React.FC = () => {
  const { isPhysicalCharactersModalOpen, togglePhysicalCharactersModal, agentVehicles, buyVehicle, agentBalances } = useStore();

  if (!isPhysicalCharactersModalOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xl">
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="w-full max-w-4xl bg-slate-900 border border-amber-500/30 rounded-3xl shadow-2xl overflow-hidden text-white flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-white/10 bg-slate-950/50">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                <Car size={26} />
              </div>
              <div>
                <h2 className="text-xl font-bold tracking-tight text-amber-300">Monopoly Physical Token Vehicles & Characters</h2>
                <p className="text-xs text-slate-400">Acquire iconic physical tokens (Racecar, Battleship, Top Hat, Thimble, Dog) for agents and CEOs</p>
              </div>
            </div>
            <button
              onClick={togglePhysicalCharactersModal}
              className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-slate-300 transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Body List */}
          <div className="p-6 overflow-y-auto space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {agentVehicles.map((vehicle) => {
                const isOwned = vehicle.ownerIndex !== undefined;
                return (
                  <div 
                    key={vehicle.id} 
                    className={`relative rounded-2xl p-5 border transition-all ${
                      isOwned 
                        ? 'bg-amber-500/10 border-amber-500/40' 
                        : 'bg-white/5 border-white/10 hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="text-3xl p-2.5 rounded-xl bg-white/10 border border-white/10 flex items-center justify-center">
                          {vehicle.icon}
                        </div>
                        <div>
                          <h3 className="font-bold text-base text-white">{vehicle.name}</h3>
                          <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            {vehicle.category}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-mono font-bold text-amber-400">${vehicle.price} VAL</div>
                        <div className="text-[10px] text-slate-400">Speed: +{vehicle.speedBonus * 100}%</div>
                      </div>
                    </div>

                    <p className="text-xs text-slate-300 mb-4">{vehicle.description}</p>

                    <div className="flex items-center justify-between pt-3 border-t border-white/10">
                      {isOwned ? (
                        <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
                          <Check size={14} />
                          <span>Owned by Agent #{vehicle.ownerIndex}</span>
                        </div>
                      ) : (
                        <div className="text-xs text-slate-400">Available for Acquisition</div>
                      )}

                      {!isOwned && (
                        <button
                          onClick={() => buyVehicle(vehicle.id, 0)} // Assign to CEO/Player (index 0) as default
                          className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-all shadow-lg shadow-amber-500/20 flex items-center gap-1.5"
                        >
                          <DollarSign size={13} />
                          <span>Buy Token (${vehicle.price})</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
