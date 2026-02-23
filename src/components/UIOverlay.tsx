
import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import DebugPanel from './DebugPanel';
import HelpModal from './HelpModal';
import ChatPanel from './ChatPanel';
import { AGENTS } from '../data/agents';
import { LayoutGrid, Users, Play } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

import SocialFeed from './SocialFeed';
import Leaderboard from './Leaderboard';
import CameraControls from './CameraControls';

const UIOverlay: React.FC = () => {
  const { 
    isThinking, 
    isDebugOpen, 
    toggleDebug, 
    selectedNpcIndex,
    selectedPosition,
    hoveredNpcIndex,
    hoverPosition,
    startChat,
    endChat,
    isChatting,
    viewMode,
    setViewMode,
    socialFeed
  } = useStore();
  const [isHelpOpen, setHelpOpen] = useState(false);

  const selectedAgent = selectedNpcIndex != null ? AGENTS[selectedNpcIndex] ?? null : null;
  const hoveredAgent = hoveredNpcIndex != null ? AGENTS[hoveredNpcIndex] ?? null : null;

  const handleStartChat = () => {
    if (selectedNpcIndex !== null) {
      startChat(selectedNpcIndex);
    }
  };

  const handleEndChat = () => {
    endChat();
  };

  return (
    <div className="fixed inset-0 pointer-events-none flex flex-col justify-between p-4 md:p-8">
      <AnimatePresence>
        <ChatPanel />
      </AnimatePresence>
      
      <SocialFeed />
      <Leaderboard />
      <CameraControls />

      {/* Live Notification Toast */}
      <AnimatePresence>
        {viewMode === 'world' && socialFeed.length > 0 && socialFeed[0].isLive && (
          <motion.div 
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -100, opacity: 0 }}
            className="fixed top-20 md:top-24 left-1/2 -translate-x-1/2 z-[120] pointer-events-auto"
          >
            <button 
              onClick={() => setViewMode('social')}
              className="bg-red-600/90 backdrop-blur-md px-3 md:px-4 py-1.5 md:py-2 rounded-full border border-white/20 shadow-2xl flex items-center gap-2 md:gap-3 group hover:scale-105 transition-transform"
            >
              <div className="w-2 h-2 bg-white rounded-full animate-ping" />
              <span className="text-[10px] font-black text-white uppercase tracking-widest">
                {AGENTS[socialFeed[0].agentIndex].role} is LIVE
              </span>
              <div className="bg-white/20 px-2 py-0.5 rounded text-[8px] font-bold text-white uppercase">Join</div>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* View Mode Toggle */}
      <div className="fixed bottom-6 md:bottom-8 left-1/2 -translate-x-1/2 flex bg-white/80 backdrop-blur-xl p-1.5 rounded-2xl border border-black/5 shadow-2xl pointer-events-auto z-[110]">
        <button 
          onClick={() => setViewMode('world')}
          className={`flex items-center gap-1.5 md:gap-2 px-4 md:px-6 py-2 md:py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
            viewMode === 'world' ? 'bg-zinc-900 text-white shadow-lg' : 'text-zinc-400 hover:text-zinc-900'
          }`}
        >
          <LayoutGrid size={14} />
          <span className="hidden sm:inline">World</span>
        </button>
        <button 
          onClick={() => setViewMode('social')}
          className={`flex items-center gap-1.5 md:gap-2 px-4 md:px-6 py-2 md:py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
            viewMode === 'social' ? 'bg-zinc-900 text-white shadow-lg' : 'text-zinc-400 hover:text-zinc-900'
          }`}
        >
          <Play size={14} fill="currentColor" />
          <span className="hidden sm:inline">Live</span>
        </button>
      </div>
      {/* Selected Bubble (Always visible when selected) */}
      {selectedAgent && selectedPosition && (
        <div 
          className="absolute z-10 pointer-events-none transition-all duration-75 ease-out"
          style={{ 
            left: selectedPosition.x, 
            top: selectedPosition.y,
            transform: 'translate(-50%, -100%) translateY(-10px)'
          }}
        >
          <div className="bg-zinc-800/90 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 shadow-xl flex items-center gap-2 whitespace-nowrap animate-in fade-in zoom-in-95 duration-200">
            <div 
              className="w-2 h-2 rounded-full shrink-0" 
              style={{ backgroundColor: selectedAgent.color }}
            />
            <div className="flex items-center gap-1.5">
              {selectedAgent.isPlayer ? (
                <span className="text-[10px] font-black uppercase tracking-widest text-white">CEO (You)</span>
              ) : (
                <>
                  <span className="text-[10px] font-black uppercase tracking-widest text-white">
                    {selectedAgent.role}
                  </span>
                  <span className="text-[10px] font-medium uppercase tracking-widest text-white/40">·</span>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-white/70">
                    {selectedAgent.department}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Hover Bubble */}
      {hoveredAgent && hoverPosition && hoveredNpcIndex !== selectedNpcIndex && (
        <div 
          className="absolute z-10 pointer-events-none transition-all duration-75 ease-out"
          style={{ 
            left: hoverPosition.x, 
            top: hoverPosition.y,
            transform: 'translate(-50%, -100%) translateY(-10px)'
          }}
        >
          <div className="bg-zinc-800/90 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 shadow-xl flex items-center gap-2 whitespace-nowrap animate-in fade-in zoom-in-95 duration-200">
            <div 
              className="w-2 h-2 rounded-full shrink-0" 
              style={{ backgroundColor: hoveredAgent.color }}
            />
            <div className="flex items-center gap-1.5">
              {hoveredAgent.isPlayer ? (
                <span className="text-[10px] font-black uppercase tracking-widest text-white">CEO (You)</span>
              ) : (
                <>
                  <span className="text-[10px] font-black uppercase tracking-widest text-white">
                    {hoveredAgent.role}
                  </span>
                  <span className="text-[10px] font-medium uppercase tracking-widest text-white/40">·</span>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-white/70">
                    {hoveredAgent.department}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Top Header */}
      <div className="flex justify-end items-start relative z-30">
        <button
          onClick={toggleDebug}
          className={`pointer-events-auto px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all duration-300 border ${
            isDebugOpen
            ? 'bg-zinc-900 text-white border-zinc-900 shadow-lg'
            : 'bg-white/80 text-zinc-500 border-black/5 hover:bg-white hover:text-zinc-900'
          }`}
        >
          {isDebugOpen ? 'Close Debug' : 'Debug'}
        </button>
      </div>

      {/* Debug Panel Mount */}
      <DebugPanel />

      {/* Help Modal */}
      <HelpModal isOpen={isHelpOpen} onClose={() => setHelpOpen(false)} />

      {/* NPC Info Panel — shown when an NPC is selected */}
      {selectedAgent && (
        <div className="absolute bottom-20 md:bottom-8 left-4 md:left-8 w-[calc(100%-2rem)] md:w-72 bg-white/85 backdrop-blur-2xl rounded-2xl border border-black/5 shadow-2xl p-4 md:p-5 pointer-events-auto animate-in fade-in slide-in-from-left-4 duration-300 z-30 overflow-hidden max-h-[50vh] md:max-h-none overflow-y-auto">
          {/* Color accent bar */}
          <div 
            className="absolute top-0 left-0 w-full h-1" 
            style={{ backgroundColor: selectedAgent.color }}
          />
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-0.5">
                {selectedAgent.department}
              </p>
              <h2 className="text-xl font-black text-zinc-900 leading-tight">{selectedAgent.role}</h2>
            </div>
          </div>

          <p className="text-xs text-zinc-600 leading-relaxed mb-3 italic">
            "{selectedAgent.mission}"
          </p>

          <div className="flex flex-wrap gap-1 mb-3">
            {selectedAgent.expertise.map((tag) => (
              <span key={tag} className="text-[10px] font-bold bg-zinc-100 text-zinc-500 px-2 py-0.5 rounded-full">
                {tag}
              </span>
            ))}
          </div>

          <p className="text-[11px] text-zinc-400 leading-snug mb-5">{selectedAgent.personality}</p>

          {isChatting ? (
            <button
              onClick={handleEndChat}
              style={{ backgroundColor: selectedAgent.color }}
              className="w-full py-3 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:brightness-90 active:scale-[0.98] transition-all shadow-lg pointer-events-auto"
            >
              End Chat
            </button>
          ) : (
            <button
              onClick={handleStartChat}
              className="w-full py-3 bg-zinc-900 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-black active:scale-[0.98] transition-all shadow-lg shadow-zinc-200 pointer-events-auto"
            >
              Start Chat
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default UIOverlay;
