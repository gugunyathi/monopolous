import React, { useState } from 'react';
import { soundEngine } from '../services/soundEngine';
import { speechEngine } from '../services/speechEngine';
import { Volume2, VolumeX, Mic, MicOff, Radio } from 'lucide-react';
import { useStore } from '../store/useStore';

export const AudioVoiceHUD: React.FC = () => {
  const [muted, setMuted] = useState(soundEngine.getIsMuted());
  const [speechActive, setSpeechActive] = useState(speechEngine.getEnabled());
  const { weather, socialFeed, activeSocialAgentIndex } = useStore();

  const handleToggleMute = () => {
    const isNowMuted = !soundEngine.toggleMute();
    setMuted(isNowMuted);
    soundEngine.updateWeatherAmbience(weather);
  };

  const handleToggleSpeech = () => {
    const nextState = !speechEngine.getEnabled();
    speechEngine.setEnabled(nextState);
    setSpeechActive(nextState);
    if (nextState && socialFeed.length > 0) {
      const top = socialFeed[0];
      speechEngine.speakCeoNews('Kaldera Market Update', top.content || 'Active Kaldera autonomous agent trading session in progress.');
    }
  };

  return (
    <div className="fixed top-20 right-4 sm:right-6 z-[140] pointer-events-auto flex items-center gap-1.5 p-1 rounded-2xl bg-slate-900/90 border border-cyan-500/30 backdrop-blur-xl shadow-xl">
      {/* Sound Ambience Toggle */}
      <button
        onClick={handleToggleMute}
        title={muted ? "Enable Ambient Sound Engine" : "Mute Sound Engine"}
        className={`flex items-center gap-1.5 px-3 py-2 rounded-xl font-bold text-xs transition-all ${
          !muted
            ? 'bg-cyan-500 text-white shadow-md shadow-cyan-500/30'
            : 'bg-slate-800 text-slate-400 hover:text-white'
        }`}
      >
        {!muted ? <Volume2 size={15} /> : <VolumeX size={15} />}
        <span className="hidden sm:inline">Ambience</span>
      </button>

      {/* Speech Commentary Toggle */}
      <button
        onClick={handleToggleSpeech}
        title={speechActive ? "Disable Voice & CEO News Reader" : "Enable Voice & CEO News Reader"}
        className={`flex items-center gap-1.5 px-3 py-2 rounded-xl font-bold text-xs transition-all ${
          speechActive
            ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/30'
            : 'bg-slate-800 text-slate-400 hover:text-white'
        }`}
      >
        {speechActive ? <Mic size={15} className="animate-pulse" /> : <MicOff size={15} />}
        <span className="hidden sm:inline">Voice AI</span>
      </button>
    </div>
  );
};
