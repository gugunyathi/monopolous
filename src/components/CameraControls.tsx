
import React from 'react';
import { ZoomIn, ZoomOut, Maximize, Minimize, ScanLine } from 'lucide-react';
import { useStore } from '../store/useStore';
import { motion } from 'motion/react';

const CameraControls: React.FC = () => {
  const { viewMode } = useStore();

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
