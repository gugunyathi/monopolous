
import React from 'react';
import { ZoomIn, ZoomOut, Maximize, Minimize, ScanLine, Flame, Car } from 'lucide-react';
import { useStore } from '../store/useStore';
import { motion } from 'motion/react';

const CameraControls: React.FC = () => {
  const { viewMode, isHeatmapMode, toggleHeatmapMode, togglePhysicalCharactersModal } = useStore();

  if (viewMode !== 'world') return null;

  const handleZoomIn = () => {
    const event = new CustomEvent('camera-zoom', { detail: { delta: -5 } });
    window.dispatchEvent(event);
  };

  const handleZoomOut = () => {
    const event = new CustomEvent('camera-zoom', { detail: { delta: 5 } });
    window.dispatchEvent(event);
  };

  const handleReset = () => {
    const event = new CustomEvent('camera-reset');
    window.dispatchEvent(event);
  };

  const handleTopDown = () => {
    const event = new CustomEvent('camera-topdown');
    window.dispatchEvent(event);
  };

  const handleOverview = () => {
    const event = new CustomEvent('camera-overview');
    window.dispatchEvent(event);
  };

  return (
    <motion.div 
      initial={{ x: 100, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      className="fixed bottom-[4.5rem] sm:bottom-20 md:bottom-24 left-3 sm:left-4 md:left-auto md:right-8 flex flex-col gap-1.5 md:gap-2 z-[100] pointer-events-auto"
    >
      <button 
        onClick={togglePhysicalCharactersModal}
        className="w-9 h-9 md:w-10 md:h-10 bg-amber-500/20 backdrop-blur-xl rounded-xl border border-amber-500/40 flex items-center justify-center text-amber-300 hover:bg-amber-500/30 transition-all shadow-lg shadow-amber-500/10"
        title="Physical Monopoly Characters & Vehicles"
      >
        <Car size={18} className="md:w-5 md:h-5 text-amber-400" />
      </button>
      <button 
        onClick={toggleHeatmapMode}
        className={`w-9 h-9 md:w-10 md:h-10 backdrop-blur-xl rounded-xl border flex items-center justify-center transition-all ${
          isHeatmapMode 
            ? 'bg-amber-500/30 border-amber-500/50 text-amber-300 shadow-lg shadow-amber-500/20' 
            : 'bg-white/10 border-white/10 text-white hover:bg-white/20'
        }`}
        title={isHeatmapMode ? "Disable Heatmap Mode" : "Enable Volume/Volatility Heatmap"}
      >
        <Flame size={18} className={`md:w-5 md:h-5 ${isHeatmapMode ? 'animate-pulse text-amber-400' : ''}`} />
      </button>
      <button 
        onClick={handleZoomIn}
        className="w-9 h-9 md:w-10 md:h-10 bg-white/10 backdrop-blur-xl rounded-xl border border-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-all"
        title="Zoom In"
      >
        <ZoomIn size={18} className="md:w-5 md:h-5" />
      </button>
      <button 
        onClick={handleZoomOut}
        className="w-9 h-9 md:w-10 md:h-10 bg-white/10 backdrop-blur-xl rounded-xl border border-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-all"
        title="Zoom Out"
      >
        <ZoomOut size={18} className="md:w-5 md:h-5" />
      </button>
      <button 
        onClick={handleOverview}
        className="w-9 h-9 md:w-10 md:h-10 bg-white/10 backdrop-blur-xl rounded-xl border border-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-all"
        title="View Whole Board"
      >
        <ScanLine size={18} className="md:w-5 md:h-5" />
      </button>
      <button 
        onClick={handleTopDown}
        className="w-9 h-9 md:w-10 md:h-10 bg-white/10 backdrop-blur-xl rounded-xl border border-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-all"
        title="Top Down View"
      >
        <Maximize size={18} className="md:w-5 md:h-5" />
      </button>
      <button 
        onClick={handleReset}
        className="w-9 h-9 md:w-10 md:h-10 bg-white/10 backdrop-blur-xl rounded-xl border border-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-all"
        title="Reset View"
      >
        <Minimize size={18} className="md:w-5 md:h-5" />
      </button>
    </motion.div>
  );
};

export default CameraControls;
