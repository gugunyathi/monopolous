import React from 'react';
import { useStore } from '../store/useStore';
import { Sun, CloudRain, Snowflake, CloudOff } from 'lucide-react';
import { soundEngine } from '../services/soundEngine';

export const WeatherWidget: React.FC = () => {
  const { weather, setWeather } = useStore();

  const handleWeatherSelect = (w: 'sun' | 'rain' | 'snow' | 'none') => {
    setWeather(w);
    soundEngine.updateWeatherAmbience(w);
  };

  return (
    <div className="fixed top-20 right-24 sm:right-32 z-[130] pointer-events-auto flex items-center gap-1 p-1 rounded-2xl bg-slate-900/90 border border-cyan-500/30 backdrop-blur-xl shadow-xl">
      <button
        onClick={() => handleWeatherSelect('none')}
        title="Normal View (Clear)"
        className={`flex items-center gap-1.5 px-3 py-2 rounded-xl font-bold text-xs transition-all ${
          weather === 'none'
            ? 'bg-slate-700 text-slate-200 border border-slate-500/40 shadow-md'
            : 'text-slate-400 hover:text-white'
        }`}
      >
        <CloudOff size={15} className="text-slate-400" />
        <span className="hidden sm:inline">Normal</span>
      </button>

      <button
        onClick={() => handleWeatherSelect('sun')}
        title="Bull Market Sunshine"
        className={`flex items-center gap-1.5 px-3 py-2 rounded-xl font-bold text-xs transition-all ${
          weather === 'sun'
            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-md shadow-amber-500/20'
            : 'text-slate-400 hover:text-white'
        }`}
      >
        <Sun size={15} className="text-amber-400" />
        <span className="hidden sm:inline">Bull</span>
      </button>

      <button
        onClick={() => handleWeatherSelect('rain')}
        title="Volatile Rain"
        className={`flex items-center gap-1.5 px-3 py-2 rounded-xl font-bold text-xs transition-all ${
          weather === 'rain'
            ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-md shadow-cyan-500/20'
            : 'text-slate-400 hover:text-white'
        }`}
      >
        <CloudRain size={15} className="text-cyan-400" />
        <span className="hidden sm:inline">Rain</span>
      </button>

      <button
        onClick={() => handleWeatherSelect('snow')}
        title="Crypto Winter Snowfall"
        className={`flex items-center gap-1.5 px-3 py-2 rounded-xl font-bold text-xs transition-all ${
          weather === 'snow'
            ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 shadow-md shadow-indigo-500/20'
            : 'text-slate-400 hover:text-white'
        }`}
      >
        <Snowflake size={15} className="text-indigo-400" />
        <span className="hidden sm:inline">Winter</span>
      </button>
    </div>
  );
};
