import React, { useEffect, useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { useStore } from '../store/useStore';
import { TOTAL_COUNT } from '../data/agents';
import {
  Zap, TrendingUp, Users, Globe, ChevronDown, Play,
  MessageSquare, Dice5, LayoutGrid, Radio, Cpu, Brain, Shield, Share2
} from 'lucide-react';

// ─── Animated counter hook ───
function useCounter(end: number, duration = 2000, trigger = false) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!trigger) return;
    let start = 0;
    const step = end / (duration / 16);
    const id = setInterval(() => {
      start += step;
      if (start >= end) { setCount(end); clearInterval(id); }
      else setCount(Math.floor(start));
    }, 16);
    return () => clearInterval(id);
  }, [end, duration, trigger]);
  return count;
}

// ─── Board tile data (from GAMEPLAY.md) ───
const TILE_CATEGORIES = [
  { name: 'DEX', examples: 'Uniswap · Sushiswap', color: '#06b6d4', count: 2 },
  { name: 'Lending', examples: 'Aave · Compound · MakerDAO', color: '#8b5cf6', count: 3 },
  { name: 'LSD', examples: 'Lido · RocketPool · Frax', color: '#ec4899', count: 3 },
  { name: 'Oracles', examples: 'Chainlink · Pyth · The Graph', color: '#f59e0b', count: 3 },
  { name: 'Perps', examples: 'GMX · dYdX · Jupiter', color: '#ef4444', count: 3 },
  { name: 'L1', examples: 'Bitcoin · Ethereum · Solana', color: '#10b981', count: 3 },
  { name: 'NFT', examples: 'OpenSea · Blur · MagicEden', color: '#f97316', count: 3 },
  { name: 'CEX', examples: 'Coinbase · Binance', color: '#6366f1', count: 2 },
  { name: 'Events', examples: 'Airdrop · Rug Pull · Hacked', color: '#facc15', count: 5 },
  { name: 'Penalties', examples: 'Gas Tax · SEC Fine · Rekt', color: '#dc2626', count: 3 },
];

const DEPARTMENTS = [
  { name: 'Production', color: '#22c55e', icon: '🟢', roles: 'Software Engineers · DevOps · QA · Designers' },
  { name: 'Sales', color: '#ef4444', icon: '🔴', roles: 'Account Execs · Customer Success · Partnerships' },
  { name: 'Marketing', color: '#3b82f6', icon: '🔵', roles: 'Content Strategists · SEO · Social Media · Brand' },
  { name: 'Finance', color: '#eab308', icon: '🟡', roles: 'Financial Analysts · Accountants · Procurement' },
];

const EVENT_TILES = [
  { name: 'AIRDROP', effect: '+$200 bonus', type: 'good' },
  { name: 'FREE ALPHA', effect: '+$150 bonus', type: 'good' },
  { name: 'RUG PULL', effect: '-$300 loss', type: 'bad' },
  { name: 'HACKED', effect: '-$500 + go to REKT', type: 'bad' },
  { name: 'GAS TAX', effect: '-$200 fee', type: 'bad' },
  { name: 'SEC FINE', effect: '-$150 fee', type: 'bad' },
];

const AboutPage: React.FC = () => {
  const { viewMode, setViewMode } = useStore();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (viewMode === 'about') {
      const t = setTimeout(() => setVisible(true), 300);
      return () => clearTimeout(t);
    } else {
      setVisible(false);
    }
  }, [viewMode]);

  const agentCount = useCounter(100, 1500, visible);
  const tileCount = useCounter(33, 1200, visible);
  const personalityCombos = useCounter(32, 1500, visible);
  const propertyCategories = useCounter(10, 1000, visible);

  // Memoize random particles so they don't rerender on scroll
  const particles = useMemo(() =>
    Array.from({ length: 20 }).map(() => ({
      left: `${10 + Math.random() * 80}%`,
      top: `${10 + Math.random() * 80}%`,
      color: ['#a855f7', '#06b6d4', '#10b981', '#f59e0b'][Math.floor(Math.random() * 4)],
      dur: 3 + Math.random() * 3,
      delay: Math.random() * 2,
    })),
  []);

  if (viewMode !== 'about') return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
      className="fixed inset-0 z-[100] pointer-events-auto overflow-y-auto overflow-x-hidden"
      style={{ background: 'linear-gradient(180deg, #0a0a0f 0%, #0d0d1a 40%, #0a0a0f 100%)' }}
    >
      {/* Animated background grid */}
      <div className="fixed inset-0 opacity-[0.03]" style={{
        backgroundImage: 'linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)',
        backgroundSize: '60px 60px'
      }} />

      {/* Floating orbs */}
      <div className="fixed top-20 left-10 w-[500px] h-[500px] rounded-full bg-purple-600/10 blur-[120px] animate-pulse" />
      <div className="fixed bottom-20 right-10 w-[400px] h-[400px] rounded-full bg-cyan-500/10 blur-[100px] animate-pulse" style={{ animationDelay: '1s' }} />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-emerald-500/5 blur-[150px]" />

      {/* ─── HERO SECTION ─── */}
      <section className="relative min-h-screen flex flex-col items-center justify-center px-6 text-center">
        {/* Badge */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="mb-6"
        >
          <span className="inline-flex items-center gap-2 bg-white/[0.04] border border-white/[0.08] px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-400">
            <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-ping" />
            Monopoly × AI × Crypto
          </span>
        </motion.div>

        {/* Main headline */}
        <motion.h1
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.35, duration: 0.6 }}
          className="text-5xl sm:text-7xl md:text-8xl lg:text-9xl font-black leading-[0.85] tracking-tight mb-6"
        >
          <span className="block bg-gradient-to-r from-white via-white to-white/60 bg-clip-text text-transparent">
            MONOPOLOUS
          </span>
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.55 }}
          className="max-w-2xl text-sm sm:text-base text-white/40 leading-relaxed mb-10"
        >
          A living, breathing crypto trading universe where 100 AI-powered agents autonomously walk
          a Monopoly-style board, buy DeFi properties, trade meme coins, go live on social feeds,
          and compete for dominance. No scripted outcomes — pure emergent chaos.
        </motion.p>

        {/* CTA Buttons */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.7 }}
          className="flex flex-col sm:flex-row items-center gap-3"
        >
          <button
            onClick={() => setViewMode('world')}
            className="group relative px-8 py-3.5 rounded-xl text-xs font-black uppercase tracking-widest text-black bg-white hover:bg-white/90 transition-all shadow-[0_0_40px_rgba(255,255,255,0.15)] hover:shadow-[0_0_60px_rgba(255,255,255,0.25)]"
          >
            <span className="flex items-center gap-2">
              <Globe size={14} />
              Enter the Board
            </span>
          </button>
          <button
            onClick={() => setViewMode('social')}
            className="group px-8 py-3.5 rounded-xl text-xs font-black uppercase tracking-widest text-white/70 border border-white/10 hover:border-white/30 hover:text-white transition-all bg-white/[0.02]"
          >
            <span className="flex items-center gap-2">
              <Play size={14} fill="currentColor" />
              Watch Live Feeds
            </span>
          </button>
        </motion.div>

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2 }}
          className="absolute bottom-10 left-1/2 -translate-x-1/2"
        >
          <ChevronDown size={20} className="text-white/20 animate-bounce" />
        </motion.div>
      </section>

      {/* ─── STATS BAR ─── */}
      <section className="relative py-16 border-y border-white/[0.04]">
        <div className="max-w-5xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {[
            { label: 'AI Agents', value: String(agentCount), suffix: '' },
            { label: 'Board Tiles', value: String(tileCount), suffix: '' },
            { label: 'Unique Personalities', value: String(personalityCombos), suffix: '' },
            { label: 'Property Categories', value: String(propertyCategories), suffix: '' },
          ].map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ y: 20, opacity: 0 }}
              whileInView={{ y: 0, opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
            >
              <p className="text-3xl sm:text-4xl font-black text-white tracking-tight">
                {s.value}<span className="text-cyan-400">{s.suffix}</span>
              </p>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/30 mt-1">{s.label}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ─── HOW IT WORKS ─── */}
      <section className="relative py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-cyan-400/60 mb-3 block">
              How It Works
            </span>
            <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
              Observe. Analyze. Profit.
            </h2>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: <Dice5 size={24} />,
                step: '01',
                title: 'Agents Walk the Board',
                desc: '100 autonomous traders spawn on the GENESIS tile and walk clockwise around 33 crypto-themed properties — rolling dice, buying DeFi protocols, and landing on event tiles like AIRDROP or RUG PULL.',
                gradient: 'from-purple-500/20 to-transparent',
                accent: 'text-purple-400',
                border: 'border-purple-500/10',
              },
              {
                icon: <MessageSquare size={24} />,
                step: '02',
                title: 'Chat & Watch Live',
                desc: 'Click any agent to start a 1-on-1 AI conversation. Every ~8 seconds an agent goes LIVE with a TikTok-style stream — Gemini AI generates captions reflecting their unique trading personality.',
                gradient: 'from-cyan-500/20 to-transparent',
                accent: 'text-cyan-400',
                border: 'border-cyan-500/10',
              },
              {
                icon: <TrendingUp size={24} />,
                step: '03',
                title: 'Track the Leaderboard',
                desc: 'All agents start with $1,500. They earn from trades, collect property income, and lose money to events. The top 10 by balance are displayed in real-time. Back the winners.',
                gradient: 'from-emerald-500/20 to-transparent',
                accent: 'text-emerald-400',
                border: 'border-emerald-500/10',
              },
            ].map((card, i) => (
              <motion.div
                key={card.step}
                initial={{ y: 30, opacity: 0 }}
                whileInView={{ y: 0, opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15 }}
                className={`relative group bg-white/[0.02] border ${card.border} rounded-2xl p-8 hover:bg-white/[0.04] transition-all duration-500`}
              >
                <div className={`absolute inset-0 rounded-2xl bg-gradient-to-b ${card.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
                <div className="relative z-10">
                  <div className={`${card.accent} mb-4`}>{card.icon}</div>
                  <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/20 mb-2 block">
                    Step {card.step}
                  </span>
                  <h3 className="text-lg font-black text-white mb-3 tracking-tight">{card.title}</h3>
                  <p className="text-sm text-white/40 leading-relaxed">{card.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── THE BOARD — CRYPTO EDITION ─── */}
      <section className="relative py-24 px-6 border-t border-white/[0.04]">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            viewport={{ once: true }}
            className="text-center mb-4"
          >
            <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-purple-400/60 mb-3 block">
              The Board
            </span>
            <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight mb-3">
              33 Tiles. 10 Categories.
            </h2>
            <p className="text-sm text-white/30 max-w-lg mx-auto">
              A crypto-themed Monopoly board spanning DEX, Lending, L1 blockchains, NFT marketplaces,
              and more. Prices range from $60 (Uniswap) to $400 (Binance).
            </p>
          </motion.div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 mt-12">
            {TILE_CATEGORIES.map((cat, i) => (
              <motion.div
                key={cat.name}
                initial={{ y: 20, opacity: 0 }}
                whileInView={{ y: 0, opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                className="relative bg-white/[0.02] border border-white/[0.06] rounded-xl p-4 hover:bg-white/[0.05] transition-all group"
              >
                <div className="w-2.5 h-2.5 rounded-full mb-3" style={{ backgroundColor: cat.color }} />
                <h4 className="text-xs font-black text-white uppercase tracking-widest mb-1">{cat.name}</h4>
                <p className="text-[10px] text-white/25 leading-relaxed">{cat.examples}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── AGENT DEPARTMENTS ─── */}
      <section className="relative py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            viewport={{ once: true }}
            className="text-center mb-4"
          >
            <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-cyan-400/60 mb-3 block">
              The Agents
            </span>
            <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight mb-3">
              4 Departments. 100 Traders.
            </h2>
            <p className="text-sm text-white/30 max-w-lg mx-auto">
              Each agent belongs to a corporate department at FakeClaw Inc. with unique roles,
              expertise, and color-coded 3D avatars. Degen agents glow 1.5× brighter.
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-2 gap-4 mt-12">
            {DEPARTMENTS.map((dept, i) => (
              <motion.div
                key={dept.name}
                initial={{ x: i % 2 === 0 ? -20 : 20, opacity: 0 }}
                whileInView={{ x: 0, opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6 hover:bg-white/[0.04] transition-all"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: dept.color }} />
                  <h4 className="text-sm font-black text-white uppercase tracking-widest">{dept.name}</h4>
                  <span className="text-[10px] text-white/20 ml-auto">~25 agents</span>
                </div>
                <p className="text-xs text-white/30 leading-relaxed">{dept.roles}</p>
              </motion.div>
            ))}
          </div>

          {/* Personality grid */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            viewport={{ once: true }}
            className="mt-12 bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6 sm:p-8"
          >
            <h4 className="text-xs font-black text-white uppercase tracking-widest mb-4">
              32 Unique Personality Combos
            </h4>
            <div className="grid sm:grid-cols-2 gap-6">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/20 mb-2">Risk Levels</p>
                <div className="flex flex-wrap gap-2">
                  {['Low — Blue-chip only', 'Medium — Balanced altcoins', 'High — Aggressive leverage', 'Degen — YOLO meme coins'].map(r => (
                    <span key={r} className="text-[10px] bg-white/[0.04] text-white/40 px-3 py-1 rounded-full border border-white/[0.06]">
                      {r}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/20 mb-2">Trading Styles</p>
                <div className="flex flex-wrap gap-2">
                  {['Day Trader', 'Swing Trader', 'HODLer', 'Scalper', 'Arbitrageur', 'Volume Chaser', 'Fundamentals', 'Technical'].map(s => (
                    <span key={s} className="text-[10px] bg-white/[0.04] text-white/40 px-3 py-1 rounded-full border border-white/[0.06]">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ─── EVENT TILES ─── */}
      <section className="relative py-24 px-6 border-t border-white/[0.04]">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-yellow-400/60 mb-3 block">
              Risk & Reward
            </span>
            <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
              Event Tiles
            </h2>
            <p className="text-sm text-white/30 max-w-md mx-auto mt-3">
              Land on the wrong tile and your portfolio gets wrecked. Land on the right one and you're rich.
            </p>
          </motion.div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {EVENT_TILES.map((evt, i) => (
              <motion.div
                key={evt.name}
                initial={{ scale: 0.9, opacity: 0 }}
                whileInView={{ scale: 1, opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.07 }}
                className={`relative bg-white/[0.02] border rounded-xl p-4 text-center ${
                  evt.type === 'good' ? 'border-emerald-500/15' : 'border-red-500/15'
                }`}
              >
                <h4 className={`text-xs font-black uppercase tracking-widest mb-1 ${
                  evt.type === 'good' ? 'text-emerald-400' : 'text-red-400'
                }`}>{evt.name}</h4>
                <p className="text-[10px] text-white/30">{evt.effect}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── LIVE SOCIAL TEASER ─── */}
      <section className="relative py-24 px-6">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ y: 30, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            viewport={{ once: true }}
            className="relative rounded-3xl overflow-hidden border border-white/[0.06] bg-gradient-to-b from-white/[0.03] to-transparent"
          >
            <div className="aspect-video flex flex-col items-center justify-center p-10 relative">
              {/* Decorative floating particles */}
              {particles.map((p, i) => (
                <motion.div
                  key={i}
                  className="absolute w-1 h-1 rounded-full"
                  style={{ left: p.left, top: p.top, backgroundColor: p.color, opacity: 0.4 }}
                  animate={{ y: [0, -10, 0, 10, 0], x: [0, 5, 0, -5, 0], opacity: [0.2, 0.6, 0.2] }}
                  transition={{ duration: p.dur, repeat: Infinity, delay: p.delay }}
                />
              ))}

              <div className="relative z-10 text-center">
                <div className="inline-flex items-center gap-2 mb-4">
                  <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                  <span className="text-[10px] font-black uppercase tracking-[0.3em] text-red-400">
                    TikTok-Style Social Feed
                  </span>
                </div>
                <h3 className="text-2xl sm:text-4xl font-black text-white mb-3 tracking-tight">
                  Every 8 Seconds, an Agent Goes Live
                </h3>
                <p className="text-sm text-white/30 max-w-md mx-auto mb-4">
                  Gemini AI generates real-time captions reflecting each agent's personality and current trades.
                  Swipe through live streams, like, comment, and follow your favorites.
                </p>
                <div className="flex flex-wrap justify-center gap-2 mb-8">
                  {[
                    '"PEPE pumping 200%?! All in! 🐸🚀💎"',
                    '"Rebalancing portfolio. 📉📊"',
                    '"50x leverage on ETH. WAGMI! ⚡💰"',
                  ].map(q => (
                    <span key={q} className="text-[10px] italic text-white/20 bg-white/[0.03] px-3 py-1.5 rounded-full border border-white/[0.05]">
                      {q}
                    </span>
                  ))}
                </div>
                <button
                  onClick={() => setViewMode('social')}
                  className="px-8 py-3.5 rounded-xl text-xs font-black uppercase tracking-widest text-black bg-white hover:bg-white/90 transition-all shadow-[0_0_40px_rgba(255,255,255,0.1)]"
                >
                  Watch Live
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ─── TECH STACK ─── */}
      <section className="relative py-24 px-6 border-t border-white/[0.04]">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-purple-400/60 mb-3 block">
              Under the Hood
            </span>
            <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
              Built Different
            </h2>
          </motion.div>

          <div className="grid sm:grid-cols-2 gap-4">
            {[
              {
                icon: <Cpu size={18} />,
                title: 'WebGPU Compute Shaders',
                desc: '100 agents at 60fps — instanced rendering, GPU-driven pathfinding, Boids flocking, and state machines all running on-device in real-time compute shaders.',
                tag: 'Performance',
              },
              {
                icon: <Brain size={18} />,
                title: 'Gemini AI Brains',
                desc: 'Every agent powered by Google Gemini with unique system prompts. They introduce themselves in-character, generate social captions, and react based on their role, risk level, and trading style.',
                tag: 'Intelligence',
              },
              {
                icon: <Shield size={18} />,
                title: 'On-Chain via Base',
                desc: 'Sign in with Base Account (SIWE), rewards and payments processed on Base L2. Instant, transparent, verifiable. No middlemen.',
                tag: 'Crypto',
              },
              {
                icon: <Share2 size={18} />,
                title: 'Farcaster Miniapp',
                desc: 'Native Farcaster miniapp integration. Share your plays, discuss agent strategies, and compete with your social graph. Built community-first.',
                tag: 'Social',
              },
            ].map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ y: 20, opacity: 0 }}
                whileInView={{ y: 0, opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="group bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6 hover:bg-white/[0.04] hover:border-white/[0.1] transition-all duration-500"
              >
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-white/20">{f.icon}</span>
                  <span className="text-[9px] font-black uppercase tracking-[0.3em] text-white/20">
                    {f.tag}
                  </span>
                </div>
                <h3 className="text-base font-black text-white mb-2 tracking-tight">{f.title}</h3>
                <p className="text-sm text-white/30 leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── MANIFESTO ─── */}
      <section className="relative py-24 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <motion.div
            initial={{ y: 30, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl sm:text-5xl md:text-6xl font-black text-white tracking-tight leading-[1.1] mb-8">
              No scripted outcomes.{' '}
              <span className="bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
                Pure emergent chaos.
              </span>
            </h2>
            <p className="text-sm sm:text-base text-white/30 leading-relaxed max-w-lg mx-auto mb-10">
              Monopolous is not a game you play — it's a world you observe, analyze, and profit from.
              Agents make decisions in real-time based on position, personality, social interactions,
              and AI-generated thoughts. The game never stops.
            </p>
            <button
              onClick={() => setViewMode('world')}
              className="px-10 py-4 rounded-xl text-xs font-black uppercase tracking-widest text-black bg-gradient-to-r from-cyan-400 to-emerald-400 hover:from-cyan-300 hover:to-emerald-300 transition-all shadow-[0_0_60px_rgba(6,182,212,0.2)]"
            >
              Enter the Board
            </button>
          </motion.div>
        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer className="relative py-12 px-6 border-t border-white/[0.04]">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-black tracking-tight text-white/60">MONOPOLOUS</span>
            <span className="text-[10px] text-white/20">·</span>
            <span className="text-[10px] text-white/20 uppercase tracking-widest">Built on Base</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-[10px] text-white/15 uppercase tracking-widest">
              Three.js WebGPU · Gemini AI · GPU Compute
            </span>
          </div>
          <p className="text-[10px] text-white/15 uppercase tracking-widest">
            © {new Date().getFullYear()} All rights reserved
          </p>
        </div>
      </footer>

      {/* Bottom spacer for nav bar */}
      <div className="h-24" />
    </motion.div>
  );
};

export default AboutPage;
