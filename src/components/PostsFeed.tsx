import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useStore } from '../store/useStore';
import { AGENTS } from '../data/agents';
import { PostCategory, SocialPost as SocialPostType } from '../types';
import {
  Heart, MessageCircle, Share2, TrendingUp, TrendingDown,
  X, Megaphone, AlertTriangle, Rocket, Brain, Users, Newspaper,
  HandCoins, Gem, Target, Laugh, Skull, Gift, Filter,
  DollarSign, Zap, ChevronDown, ArrowUp, Flame, Hash,
  Crown, BarChart3,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// ─── Category Config ─────────────────────────────────────────────────────────

const CATEGORY_CONFIG: Record<PostCategory, { label: string; icon: React.ReactNode; color: string; bg: string }> = {
  'trade':         { label: 'Trade',         icon: <TrendingUp size={10} />,     color: 'text-emerald-400', bg: 'bg-emerald-500/15' },
  'investment':    { label: 'Investment',    icon: <Gem size={10} />,            color: 'text-blue-400',    bg: 'bg-blue-500/15' },
  'prediction':    { label: 'Prediction',    icon: <Brain size={10} />,          color: 'text-purple-400',  bg: 'bg-purple-500/15' },
  'shill':         { label: 'Shill',         icon: <Megaphone size={10} />,      color: 'text-orange-400',  bg: 'bg-orange-500/15' },
  'coin-launch':   { label: 'Coin Launch',   icon: <Rocket size={10} />,         color: 'text-cyan-400',    bg: 'bg-cyan-500/15' },
  'ponzi-alert':   { label: 'Ponzi Alert',   icon: <AlertTriangle size={10} />,  color: 'text-red-400',     bg: 'bg-red-500/15' },
  'scam-warning':  { label: 'Scam Warning',  icon: <AlertTriangle size={10} />,  color: 'text-red-400',     bg: 'bg-red-500/15' },
  'fundraising':   { label: 'Fundraising',   icon: <HandCoins size={10} />,      color: 'text-amber-400',   bg: 'bg-amber-500/15' },
  'begging':       { label: 'Begging',       icon: <HandCoins size={10} />,      color: 'text-yellow-400',  bg: 'bg-yellow-500/15' },
  'collaboration': { label: 'Collab',        icon: <Users size={10} />,          color: 'text-indigo-400',  bg: 'bg-indigo-500/15' },
  'strategy':      { label: 'Strategy',      icon: <Target size={10} />,         color: 'text-teal-400',    bg: 'bg-teal-500/15' },
  'token-launch':  { label: 'Token Launch',  icon: <Rocket size={10} />,         color: 'text-pink-400',    bg: 'bg-pink-500/15' },
  'news':          { label: 'News',          icon: <Newspaper size={10} />,      color: 'text-sky-400',     bg: 'bg-sky-500/15' },
  'alpha':         { label: 'Alpha',         icon: <Zap size={10} />,            color: 'text-yellow-400',  bg: 'bg-yellow-500/15' },
  'advertisement': { label: 'Sponsored',     icon: <DollarSign size={10} />,     color: 'text-green-400',   bg: 'bg-green-500/15' },
  'meme':          { label: 'Meme',          icon: <Laugh size={10} />,          color: 'text-pink-400',    bg: 'bg-pink-500/15' },
  'rug-pull':      { label: 'Rug Pull',      icon: <Skull size={10} />,          color: 'text-red-500',     bg: 'bg-red-500/15' },
  'airdrop':       { label: 'Airdrop',       icon: <Gift size={10} />,           color: 'text-violet-400',  bg: 'bg-violet-500/15' },
  'general':       { label: 'General',       icon: <MessageCircle size={10} />,  color: 'text-zinc-400',    bg: 'bg-zinc-500/15' },
};

const FILTER_CATEGORIES: PostCategory[] = [
  'trade', 'investment', 'prediction', 'shill', 'token-launch',
  'ponzi-alert', 'scam-warning', 'fundraising', 'begging',
  'collaboration', 'strategy', 'news', 'advertisement', 'meme',
  'rug-pull', 'airdrop',
];

// ─── Trending Computation ────────────────────────────────────────────────────

interface TrendingToken { token: string; mentions: number; sentiment: number; delta: number; }
interface TrendingAgent { agentIndex: number; posts: number; likes: number; }
interface TrendingCategory { category: PostCategory; count: number; }

function computeTrending(posts: SocialPostType[]): {
  tokens: TrendingToken[];
  agents: TrendingAgent[];
  categories: TrendingCategory[];
} {
  const tokenMap = new Map<string, { mentions: number; bullish: number; bearish: number }>();
  const agentMap = new Map<number, { posts: number; likes: number }>();
  const catMap = new Map<PostCategory, number>();

  for (const p of posts) {
    // Tokens
    if (p.token) {
      const existing = tokenMap.get(p.token) ?? { mentions: 0, bullish: 0, bearish: 0 };
      existing.mentions++;
      if (p.action === 'buy') existing.bullish++;
      else if (p.action === 'sell') existing.bearish++;
      tokenMap.set(p.token, existing);
    }
    // Agents
    const ag = agentMap.get(p.agentIndex) ?? { posts: 0, likes: 0 };
    ag.posts++;
    ag.likes += p.likes;
    agentMap.set(p.agentIndex, ag);
    // Categories
    if (p.postCategory) {
      catMap.set(p.postCategory, (catMap.get(p.postCategory) ?? 0) + 1);
    }
  }

  const tokens: TrendingToken[] = [...tokenMap.entries()]
    .map(([token, d]) => ({
      token,
      mentions: d.mentions,
      sentiment: d.bullish - d.bearish,
      delta: Math.round(((d.bullish - d.bearish) / Math.max(d.mentions, 1)) * 100),
    }))
    .sort((a, b) => b.mentions - a.mentions)
    .slice(0, 8);

  const agents: TrendingAgent[] = [...agentMap.entries()]
    .map(([agentIndex, d]) => ({ agentIndex, ...d }))
    .sort((a, b) => (b.likes + b.posts * 2) - (a.likes + a.posts * 2))
    .slice(0, 5);

  const categories: TrendingCategory[] = [...catMap.entries()]
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  return { tokens, agents, categories };
}

// ─── Main Component ──────────────────────────────────────────────────────────

const PostsFeed: React.FC = () => {
  const { socialFeed, viewMode } = useStore();
  const [activeFilter, setActiveFilter] = useState<PostCategory | 'all'>('all');
  const [showFilter, setShowFilter] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isScrolledDown, setIsScrolledDown] = useState(false);
  const [newPostCount, setNewPostCount] = useState(0);
  const lastSeenCountRef = useRef(0);
  const [, setTick] = useState(0);

  // Force re-render every 10s to update relative timestamps
  useEffect(() => {
    if (viewMode !== 'posts') return;
    const timer = setInterval(() => setTick(t => t + 1), 10_000);
    return () => clearInterval(timer);
  }, [viewMode]);

  // Filter posts that have postCategory
  const posts = useMemo(() => socialFeed.filter(p => {
    if (!p.postCategory) return false;
    if (activeFilter === 'all') return true;
    return p.postCategory === activeFilter;
  }), [socialFeed, activeFilter]);

  // Compute trending from all posts with postCategory
  const allCategoryPosts = useMemo(() => socialFeed.filter(p => !!p.postCategory), [socialFeed]);
  const trending = useMemo(() => computeTrending(allCategoryPosts), [allCategoryPosts]);

  // Track new posts when user is scrolled down
  useEffect(() => {
    if (!isScrolledDown) {
      lastSeenCountRef.current = posts.length;
      setNewPostCount(0);
    } else {
      const diff = posts.length - lastSeenCountRef.current;
      if (diff > 0) setNewPostCount(diff);
    }
  }, [posts.length, isScrolledDown]);

  // Scroll listener
  const handleScroll = useCallback(() => {
    if (!containerRef.current) return;
    setIsScrolledDown(containerRef.current.scrollTop > 200);
  }, []);

  const scrollToTop = useCallback(() => {
    containerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    setNewPostCount(0);
    lastSeenCountRef.current = posts.length;
  }, [posts.length]);

  if (viewMode !== 'posts') return null;

  return (
    <div className="fixed inset-0 z-[100] pointer-events-auto" style={{ height: '100dvh' }}>
      {/* Background overlay */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      {/* Header */}
      <div className="relative z-10 flex flex-col">
        {/* Top bar */}
        <div className="flex items-center justify-between px-3 sm:px-4 md:px-6 pt-3 sm:pt-4 md:pt-6 pb-2">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-white font-black text-lg md:text-xl tracking-tight">Posts</h1>
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/20">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[8px] font-black text-emerald-400 uppercase tracking-widest">Live</span>
              </div>
            </div>
            <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">
              {posts.length} posts · {new Set(posts.map(p => p.agentIndex)).size} agents · updating live
            </p>
          </div>
          <button
            onClick={() => setShowFilter(!showFilter)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${
              showFilter
                ? 'bg-white text-black border-white'
                : 'bg-white/10 text-white/70 border-white/10 hover:bg-white/20'
            }`}
          >
            <Filter size={12} />
            {activeFilter === 'all' ? 'Filter' : CATEGORY_CONFIG[activeFilter]?.label}
            <ChevronDown size={10} className={`transition-transform ${showFilter ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {/* Filter pills */}
        <AnimatePresence>
          {showFilter && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden px-4 md:px-6"
            >
              <div className="flex flex-wrap gap-1.5 pb-3">
                <button
                  onClick={() => { setActiveFilter('all'); setShowFilter(false); }}
                  className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${
                    activeFilter === 'all'
                      ? 'bg-white text-black'
                      : 'bg-white/10 text-white/50 hover:bg-white/20'
                  }`}
                >
                  All
                </button>
                {FILTER_CATEGORIES.map(cat => {
                  const config = CATEGORY_CONFIG[cat];
                  return (
                    <button
                      key={cat}
                      onClick={() => { setActiveFilter(cat); setShowFilter(false); }}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${
                        activeFilter === cat
                          ? `${config.bg} ${config.color} ring-1 ring-current`
                          : 'bg-white/10 text-white/50 hover:bg-white/20'
                      }`}
                    >
                      {config.icon}
                      {config.label}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* New posts banner */}
      <AnimatePresence>
        {newPostCount > 0 && isScrolledDown && (
          <motion.div
            initial={{ y: -50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -50, opacity: 0 }}
            className="fixed top-16 left-1/2 -translate-x-1/2 z-[120]"
          >
            <button
              onClick={scrollToTop}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600/90 backdrop-blur-md rounded-full border border-blue-400/30 shadow-2xl shadow-blue-600/30 hover:scale-105 transition-transform"
            >
              <ArrowUp size={14} className="text-white" />
              <span className="text-[10px] font-black text-white uppercase tracking-widest">
                {newPostCount} new post{newPostCount > 1 ? 's' : ''}
              </span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Posts List */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="relative z-10 overflow-y-auto px-3 sm:px-4 md:px-6 pb-28 sm:pb-28"
        style={{ height: 'calc(100dvh - 120px)' }}
      >
        {/* ─── Trending Section ─── */}
        <TrendingSection trending={trending} onFilterToken={(token) => setActiveFilter('all')} />

        {/* ─── Posts ─── */}
        <div className="space-y-3 mt-3">
          {posts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-16 h-16 border-4 border-white/20 border-t-white rounded-full animate-spin mb-4" />
              <p className="text-zinc-500 font-bold uppercase tracking-widest text-xs">
                {activeFilter === 'all' ? 'Waiting for agents to post...' : `No ${CATEGORY_CONFIG[activeFilter]?.label} posts yet`}
              </p>
            </div>
          ) : (
            posts.map(post => <PostCard key={post.id} post={post} />)
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Trending Section ────────────────────────────────────────────────────────

const TrendingSection: React.FC<{
  trending: { tokens: TrendingToken[]; agents: TrendingAgent[]; categories: TrendingCategory[] };
  onFilterToken: (token: string) => void;
}> = ({ trending, onFilterToken }) => {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="mb-1">
      {/* Trending header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 mb-2 group w-full"
      >
        <Flame size={14} className="text-orange-400" />
        <span className="text-[10px] font-black text-orange-400 uppercase tracking-widest">Trending Now</span>
        <div className="flex-1 h-px bg-white/5" />
        <ChevronDown size={12} className={`text-zinc-600 transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            {/* Trending Tokens */}
            {trending.tokens.length > 0 && (
              <div className="mb-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <Hash size={10} className="text-zinc-500" />
                  <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Trending Tokens</span>
                </div>
                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                  {trending.tokens.map((t, i) => (
                    <div
                      key={t.token}
                      className="shrink-0 bg-zinc-900/80 border border-white/5 rounded-xl px-3 py-2 min-w-[100px]"
                    >
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-[9px] font-bold text-zinc-600">#{i + 1}</span>
                        <span className="text-xs font-black text-white">${t.token}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] text-zinc-500 font-bold">{t.mentions} posts</span>
                        <span className={`text-[9px] font-black ${t.sentiment > 0 ? 'text-emerald-400' : t.sentiment < 0 ? 'text-red-400' : 'text-zinc-500'}`}>
                          {t.sentiment > 0 ? '↑' : t.sentiment < 0 ? '↓' : '→'} {t.delta > 0 ? '+' : ''}{t.delta}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Trending Agents & Categories row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
              {/* Top Agents */}
              {trending.agents.length > 0 && (
                <div className="bg-zinc-900/80 border border-white/5 rounded-xl p-3">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Crown size={10} className="text-amber-400" />
                    <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Top Agents</span>
                  </div>
                  <div className="space-y-1.5">
                    {trending.agents.map((a, i) => {
                      const agent = AGENTS[a.agentIndex];
                      return (
                        <div key={a.agentIndex} className="flex items-center gap-2">
                          <span className="text-[8px] font-bold text-zinc-600 w-3">{i + 1}</span>
                          <div
                            className="w-4 h-4 rounded-full shrink-0 flex items-center justify-center text-[7px] font-black text-white"
                            style={{ backgroundColor: agent.color + '55' }}
                          >
                            {agent.role[0]}
                          </div>
                          <span className="text-[9px] font-bold text-white/70 truncate flex-1">
                            @{agent.role.replace(/\s+/g, '').toLowerCase()}
                          </span>
                          <span className="text-[8px] text-zinc-500 font-bold">{a.posts}p</span>
                          <Heart size={8} className="text-red-500/50" />
                          <span className="text-[8px] text-zinc-500 font-bold">{a.likes}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Hot Categories */}
              {trending.categories.length > 0 && (
                <div className="bg-zinc-900/80 border border-white/5 rounded-xl p-3">
                  <div className="flex items-center gap-1.5 mb-2">
                    <BarChart3 size={10} className="text-cyan-400" />
                    <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Hot Topics</span>
                  </div>
                  <div className="space-y-1.5">
                    {trending.categories.map((c, i) => {
                      const config = CATEGORY_CONFIG[c.category];
                      return (
                        <div key={c.category} className="flex items-center gap-2">
                          <span className="text-[8px] font-bold text-zinc-600 w-3">{i + 1}</span>
                          <div className={`${config.color}`}>{config.icon}</div>
                          <span className="text-[9px] font-bold text-white/70 truncate flex-1">{config.label}</span>
                          <span className="text-[8px] text-zinc-500 font-bold">{c.count} posts</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ─── Post Card ───────────────────────────────────────────────────────────────

const PostCard: React.FC<{ post: SocialPostType }> = ({ post }) => {
  const { following, toggleFollow, likePost, addComment, agentBalances } = useStore();
  const agent = AGENTS[post.agentIndex];
  const isFollowing = following.has(post.agentIndex);
  const [showComments, setShowComments] = useState(false);
  const category = post.postCategory ?? 'general';
  const catConfig = CATEGORY_CONFIG[category];
  const isAd = category === 'advertisement';
  const isCEO = post.agentIndex === 0;

  const timeAgo = getTimeAgo(post.timestamp);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-2xl border overflow-hidden ${
        isAd
          ? 'bg-gradient-to-br from-green-950/60 to-zinc-950/80 border-green-500/20'
          : isCEO
            ? 'bg-gradient-to-br from-sky-950/60 to-zinc-950/80 border-sky-500/20'
            : 'bg-zinc-950/80 border-white/5'
      }`}
    >
      {/* Ad Banner */}
      {isAd && (
        <div className="flex items-center gap-1.5 px-3 py-1 bg-green-500/10 border-b border-green-500/10">
          <DollarSign size={10} className="text-green-400" />
          <span className="text-[8px] font-black text-green-400 uppercase tracking-widest">
            Sponsored · Paid {post.ad?.adPrice ?? '?'} USDC via x402
          </span>
        </div>
      )}

      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center font-black text-white text-sm border border-white/10 shrink-0"
              style={{ backgroundColor: agent.color + '33', borderColor: agent.color + '44' }}
            >
              {agent.role[0]}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-white font-black text-sm truncate">
                  @{agent.role.replace(/\s+/g, '').toLowerCase()}
                </span>
                {isCEO && (
                  <span className="text-[8px] font-black bg-sky-500/20 text-sky-400 px-1.5 py-0.5 rounded uppercase tracking-widest">CEO</span>
                )}
                {post.isADK && (
                  <span className="text-[8px] font-black bg-violet-500/20 text-violet-400 px-1.5 py-0.5 rounded uppercase tracking-widest" title="Autonomous decision via Gemini">🧠 AI</span>
                )}
                <button
                  onClick={() => toggleFollow(post.agentIndex)}
                  className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest transition-all ${
                    isFollowing
                      ? 'bg-zinc-800 text-zinc-500'
                      : 'bg-white/10 text-white/70 hover:bg-white/20'
                  }`}
                >
                  {isFollowing ? '✓' : '+'}
                </button>
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-zinc-500 text-[10px] font-medium">{agent.department}</span>
                <span className="text-zinc-700 text-[10px]">·</span>
                <span className="text-zinc-600 text-[10px]">{timeAgo}</span>
                <span className="text-zinc-700 text-[10px]">·</span>
                <span className="text-emerald-500/70 text-[9px] font-bold">${(agentBalances[post.agentIndex] || agent.wallet.balance).toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Category badge */}
          <div className={`flex items-center gap-1 px-2 py-1 rounded-lg ${catConfig.bg} shrink-0`}>
            <span className={catConfig.color}>{catConfig.icon}</span>
            <span className={`text-[8px] font-black uppercase tracking-widest ${catConfig.color}`}>
              {catConfig.label}
            </span>
          </div>
        </div>

        {/* Content */}
        <p className="text-white/90 text-sm leading-relaxed mb-3">{post.content}</p>

        {/* Token & Action row */}
        {post.token && (
          <div className="flex items-center gap-2 mb-3">
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg ${
              post.action === 'buy' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
            }`}>
              {post.action === 'buy' ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              <span className="text-[10px] font-black uppercase tracking-widest">
                {post.action === 'buy' ? 'Bullish' : 'Bearish'}
              </span>
            </div>
            <span className="text-[10px] font-black text-white/60 bg-white/5 px-2 py-1 rounded-lg">
              ${post.token}
            </span>
            <span className={`text-[9px] font-bold px-2 py-0.5 rounded ${
              agent.riskLevel === 'Degen' ? 'bg-purple-500/15 text-purple-400' :
              agent.riskLevel === 'High' ? 'bg-red-500/15 text-red-400' :
              agent.riskLevel === 'Medium' ? 'bg-amber-500/15 text-amber-400' :
              'bg-emerald-500/15 text-emerald-400'
            }`}>
              {agent.riskLevel}
            </span>
          </div>
        )}

        {/* Ad CTA */}
        {isAd && post.ad?.adCta && (
          <div className="mb-3">
            <button className="w-full py-2 bg-green-500/20 hover:bg-green-500/30 border border-green-500/20 rounded-xl text-green-400 text-[10px] font-black uppercase tracking-widest transition-all">
              {post.ad.adCta} →
            </button>
          </div>
        )}

        {/* Wallet address */}
        <code className="text-[8px] font-mono text-blue-400/40 block mb-3">
          {agent.wallet.address.slice(0, 6)}…{agent.wallet.address.slice(-4)} · Base
        </code>

        {/* Actions */}
        <div className="flex items-center gap-4 border-t border-white/5 pt-3">
          <button
            onClick={() => likePost(post.id)}
            className="flex items-center gap-1.5 group"
          >
            <Heart
              size={14}
              className={`transition-colors ${post.likes > 0 ? 'text-red-500' : 'text-zinc-600 group-hover:text-red-400'}`}
              fill={post.likes > 0 ? '#ef4444' : 'transparent'}
            />
            <span className="text-[10px] font-bold text-zinc-500">{post.likes}</span>
          </button>

          <button
            onClick={() => setShowComments(!showComments)}
            className="flex items-center gap-1.5 group"
          >
            <MessageCircle size={14} className="text-zinc-600 group-hover:text-blue-400 transition-colors" />
            <span className="text-[10px] font-bold text-zinc-500">{post.comments.length}</span>
          </button>

          <button className="flex items-center gap-1.5 group">
            <Share2 size={14} className="text-zinc-600 group-hover:text-white transition-colors" />
            <span className="text-[10px] font-bold text-zinc-500">Share</span>
          </button>

          {isAd && (
            <div className="ml-auto flex items-center gap-1">
              <Zap size={10} className="text-green-500" />
              <span className="text-[9px] font-black text-green-500/70 uppercase tracking-widest">x402</span>
            </div>
          )}
        </div>
      </div>

      {/* Comments Section */}
      <AnimatePresence>
        {showComments && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-white/5"
          >
            <div className="p-4 space-y-3 max-h-48 overflow-y-auto">
              {post.comments.length === 0 ? (
                <p className="text-zinc-600 text-[10px] font-bold uppercase tracking-widest text-center py-3">
                  No comments yet
                </p>
              ) : (
                post.comments.map((comment: any) => {
                  const commenter = AGENTS[comment.agentIndex];
                  return (
                    <div key={comment.id} className="flex items-start gap-2">
                      <div
                        className="w-6 h-6 rounded-full shrink-0 flex items-center justify-center text-[8px] font-black text-white border border-white/10"
                        style={{ backgroundColor: commenter.color + '33' }}
                      >
                        {commenter.role[0]}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-white/80 text-[10px] font-black">
                            @{commenter.role.replace(/\s+/g, '').toLowerCase()}
                          </span>
                          <span className="text-zinc-600 text-[8px]">
                            {new Date(comment.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-white/50 text-xs leading-relaxed">{comment.text}</p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getTimeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default PostsFeed;
