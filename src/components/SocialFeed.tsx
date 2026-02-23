
import React, { useEffect, useRef, useState } from 'react';
import { useStore } from '../store/useStore';
import { AGENTS } from '../data/agents';
import { Heart, MessageCircle, Share2, UserPlus, UserCheck, TrendingUp, TrendingDown, X, Send, Megaphone, Building2, Zap, AlertTriangle, Gift, ShieldAlert, MapPin } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const SocialFeed: React.FC = () => {
  const { socialFeed, viewMode, setActiveSocialAgentIndex, agentBalances } = useStore();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (viewMode !== 'social') {
      setActiveSocialAgentIndex(null);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const index = parseInt(entry.target.getAttribute('data-agent-index') || '-1');
            if (index !== -1) {
              setActiveSocialAgentIndex(index);
            }
          }
        });
      },
      { threshold: 0.6 }
    );

    const elements = containerRef.current?.querySelectorAll('[data-agent-index]');
    elements?.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, [viewMode, socialFeed, setActiveSocialAgentIndex]);

  if (viewMode !== 'social') return null;

  return (
    <div 
      ref={containerRef}
      className="fixed inset-0 bg-transparent z-[100] overflow-y-scroll snap-y snap-mandatory scrollbar-hide pointer-events-auto"
    >
      {socialFeed.length === 0 ? (
        <div className="h-screen w-full flex flex-col items-center justify-center text-white p-8 text-center bg-black/60 backdrop-blur-md">
          <div className="w-16 h-16 border-4 border-white/20 border-t-white rounded-full animate-spin mb-4" />
          <p className="text-zinc-400 font-bold uppercase tracking-widest text-xs">Waiting for agents to go live...</p>
        </div>
      ) : (
        socialFeed.map((post) => (
          <SocialPost key={post.id} post={post} />
        ))
      )}
    </div>
  );
};

const SocialPost: React.FC<{ post: any }> = ({ post }) => {
  const { following, toggleFollow, likePost, agentBalances } = useStore();
  const agent = AGENTS[post.agentIndex];
  const isFollowing = following.has(post.agentIndex);
  const [showComments, setShowComments] = useState(false);

  return (
    <div 
      data-agent-index={post.agentIndex}
      className="h-screen w-full snap-start relative flex flex-col items-center justify-center bg-transparent overflow-hidden"
    >
      {/* Dark overlay to make 3D scene look like a background video */}
      <div className="absolute inset-0 bg-black/20 pointer-events-none" />
      
      {/* Top gradient for status bar readability */}
      <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-black/60 to-transparent z-10 pointer-events-none" />

      {/* Background "Video" glow */}
      <div 
        className="absolute inset-0 opacity-40 blur-3xl pointer-events-none"
        style={{ background: `radial-gradient(circle at center, ${agent.color}, transparent)` }}
      />
      
      {/* Agent Avatar/Visual - removed large circle to show 3D agent behind */}
      <motion.div 
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="relative z-10 flex flex-col items-center pointer-events-none"
      >
        {post.isLive && (
          <div className="mt-4 flex items-center gap-2">
            <div className="relative">
              <div className="absolute inset-0 rounded-md bg-red-600 animate-ping opacity-75" />
              <div className="relative bg-red-600 px-3 py-1 rounded-md text-[10px] font-black text-white uppercase tracking-widest shadow-lg shadow-red-600/50 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-[blink_0.8s_step-start_infinite]" />
                LIVE
              </div>
            </div>
          </div>
        )}
      </motion.div>

      {/* Trading Info Overlay */}
      {post.token && (
        <motion.div 
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          className="absolute top-1/4 left-4 md:left-8 z-20 flex flex-col gap-2 md:gap-3"
        >
          {/* Trading Card */}
          <div className="bg-black/40 backdrop-blur-md p-3 md:p-4 rounded-2xl border border-white/10">
            <div className="flex items-center gap-2 md:gap-3">
              <div className={`p-1.5 md:p-2 rounded-lg ${post.action === 'buy' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                {post.action === 'buy' ? <TrendingUp size={16} className="md:w-5 md:h-5" /> : <TrendingDown size={16} className="md:w-5 md:h-5" />}
              </div>
              <div>
                <p className="text-[10px] font-black text-white/40 uppercase tracking-widest">{post.action === 'buy' ? 'Buying' : 'Selling'}</p>
                <p className="text-base md:text-lg font-black text-white tracking-tight">${post.token}</p>
              </div>
            </div>
          </div>

          {/* Risk & Style Pills */}
          <div className="flex gap-2">
            <div className="bg-white/10 backdrop-blur-md px-3 py-1 rounded-full border border-white/10">
              <p className="text-[8px] font-black text-white uppercase tracking-widest">Risk: {agent.riskLevel}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-md px-3 py-1 rounded-full border border-white/10">
              <p className="text-[8px] font-black text-white uppercase tracking-widest">{agent.outfit}</p>
            </div>
          </div>
        </motion.div>
      )}

      {/* x402 Payment Info Overlay */}
      {post.type === 'x402' && post.x402 && (
        <motion.div
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          className="absolute top-1/4 left-4 md:left-8 z-20 flex flex-col gap-2 md:gap-3"
        >
          <div className="bg-blue-500/10 backdrop-blur-md p-3 md:p-4 rounded-2xl border border-blue-400/20">
            <div className="flex items-center gap-2 md:gap-3">
              <div className="p-1.5 md:p-2 rounded-lg bg-blue-500/20 text-blue-400">
                <Share2 size={16} className="md:w-5 md:h-5" />
              </div>
              <div>
                <p className="text-[10px] font-black text-blue-300/60 uppercase tracking-widest">x402 Payment</p>
                <p className="text-base md:text-lg font-black text-white tracking-tight">{post.x402.price} USDC</p>
              </div>
            </div>
            {post.x402.category && (
              <p className="text-[9px] font-bold text-blue-300/50 uppercase tracking-widest mt-2">{post.x402.category}</p>
            )}
          </div>

          {post.x402.command && (
            <div className="bg-black/60 backdrop-blur-md px-3 py-2 rounded-xl border border-white/5">
              <code className="text-[8px] font-mono text-emerald-300/70 break-all">{post.x402.command}</code>
            </div>
          )}

          <div className="flex gap-2">
            <div className="bg-blue-500/10 backdrop-blur-md px-3 py-1 rounded-full border border-blue-400/10">
              <p className="text-[8px] font-black text-blue-300 uppercase tracking-widest">x402</p>
            </div>
            <div className="bg-white/10 backdrop-blur-md px-3 py-1 rounded-full border border-white/10">
              <p className="text-[8px] font-black text-white uppercase tracking-widest">Base</p>
            </div>
          </div>
        </motion.div>
      )}

      {/* CEO Broadcast Overlay */}
      {post.type === 'broadcast' && post.broadcast && (() => {
        const b = post.broadcast;
        const sentimentColor =
          b.sentiment === 1 ? { border: 'border-emerald-400/30', bg: 'bg-emerald-500/10', badge: 'bg-emerald-500/20 text-emerald-300', icon: 'text-emerald-400', label: 'BULLISH' }
          : b.sentiment === -1 ? { border: 'border-red-400/30', bg: 'bg-red-500/10', badge: 'bg-red-500/20 text-red-300', icon: 'text-red-400', label: 'BEARISH' }
          : { border: 'border-amber-400/30', bg: 'bg-amber-500/10', badge: 'bg-amber-500/20 text-amber-300', icon: 'text-amber-400', label: b.category.toUpperCase() };
        return (
          <motion.div
            key={b.id}
            initial={{ x: -24, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            className="absolute top-1/4 left-4 md:left-8 z-20 flex flex-col gap-2 max-w-[220px] md:max-w-[280px]"
          >
            <div className={`${sentimentColor.bg} backdrop-blur-md p-3 md:p-4 rounded-2xl border ${sentimentColor.border}`}>
              <div className="flex items-center gap-2 mb-2">
                <div className={`p-1.5 rounded-lg bg-white/10 ${sentimentColor.icon}`}>
                  <Megaphone size={15} />
                </div>
                <div>
                  <p className="text-[9px] font-black text-white/40 uppercase tracking-widest">CEO Broadcast</p>
                  <span className={`text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest ${sentimentColor.badge}`}>{sentimentColor.label}</span>
                </div>
              </div>
              <p className="text-white font-black text-xs md:text-sm leading-snug mb-1.5">{b.headline}</p>
              <p className="text-white/50 text-[9px] leading-relaxed line-clamp-2">{b.detail}</p>
              {b.tokens.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {b.tokens.slice(0, 5).map((t: string) => (
                    <span key={t} className="text-[8px] font-black px-1.5 py-0.5 rounded-md bg-white/10 text-white/70 uppercase">${t}</span>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        );
      })()}

      {/* Tile Event Overlay */}
      {post.type === 'tile' && post.tileEvent && (() => {
        const te = post.tileEvent!;
        const effectMeta: Record<string, { border: string; bg: string; badge: string; label: string; icon: React.ReactNode }> = {
          buy:    { border: 'border-emerald-400/30', bg: 'bg-emerald-500/10', badge: 'bg-emerald-500/20 text-emerald-300', label: 'ACQUIRED', icon: <Building2 size={15} /> },
          rent:   { border: 'border-amber-400/30',   bg: 'bg-amber-500/10',   badge: 'bg-amber-500/20 text-amber-300',   label: 'RENT PAID', icon: <MapPin size={15} /> },
          yield:  { border: 'border-blue-400/30',    bg: 'bg-blue-500/10',    badge: 'bg-blue-500/20 text-blue-300',    label: 'YIELD',    icon: <TrendingUp size={15} /> },
          airdrop:{ border: 'border-purple-400/30',  bg: 'bg-purple-500/10',  badge: 'bg-purple-500/20 text-purple-300', label: 'AIRDROP',  icon: <Gift size={15} /> },
          rug:    { border: 'border-red-400/30',     bg: 'bg-red-500/10',     badge: 'bg-red-500/20 text-red-300',     label: 'RUG PULL', icon: <AlertTriangle size={15} /> },
          hack:   { border: 'border-red-600/30',     bg: 'bg-red-600/10',     badge: 'bg-red-600/20 text-red-400',     label: 'HACKED',   icon: <ShieldAlert size={15} /> },
          tax:    { border: 'border-orange-400/30',  bg: 'bg-orange-500/10',  badge: 'bg-orange-500/20 text-orange-300', label: 'TAX',    icon: <Zap size={15} /> },
          jail:   { border: 'border-zinc-400/30',    bg: 'bg-zinc-500/10',    badge: 'bg-zinc-500/20 text-zinc-300',    label: 'REKT',     icon: <X size={15} /> },
          alpha:  { border: 'border-cyan-400/30',    bg: 'bg-cyan-500/10',    badge: 'bg-cyan-500/20 text-cyan-300',    label: 'FREE ALPHA', icon: <TrendingUp size={15} /> },
        };
        const m = effectMeta[te.effect] ?? effectMeta['buy'];
        return (
          <motion.div
            initial={{ x: -24, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            className="absolute top-1/4 left-4 md:left-8 z-20 max-w-[200px] md:max-w-[250px]"
          >
            <div className={`${m.bg} backdrop-blur-md p-3 md:p-4 rounded-2xl border ${m.border}`}>
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 rounded-lg bg-white/10 text-white/70">{m.icon}</div>
                <div>
                  <p className="text-[9px] font-black text-white/40 uppercase tracking-widest">Tile Event</p>
                  <span className={`text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest ${m.badge}`}>{m.label}</span>
                </div>
              </div>
              <p className="text-white font-black text-xs md:text-sm leading-snug">{te.tileName}</p>
              {te.amount != null && (
                <p className={`text-[10px] font-bold mt-1 ${te.effect === 'buy' || te.effect === 'yield' || te.effect === 'airdrop' || te.effect === 'alpha' ? 'text-emerald-400' : 'text-red-400'}`}>
                  {te.effect === 'buy' ? `-$${te.amount}` : te.effect === 'rent' ? `-$${te.amount}` : te.effect === 'tax' ? `-$${te.amount}` : `+$${te.amount}`}
                </p>
              )}
            </div>
          </motion.div>
        );
      })()}

      {/* Bottom Info */}
      <div className="absolute bottom-0 left-0 w-full p-4 md:p-8 pb-20 md:pb-24 bg-gradient-to-t from-black/80 to-transparent z-20">
        <div className="flex items-center gap-2 md:gap-3 mb-3 md:mb-4">
          <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-white/10 border border-white/20 flex items-center justify-center font-black text-white text-sm md:text-base">
            {agent.role[0]}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-white font-black text-base md:text-lg tracking-tight">@{agent.role.replace(/\s+/g, '').toLowerCase()}</h3>
              <button 
                onClick={() => toggleFollow(post.agentIndex)}
                className={`px-2 md:px-3 py-0.5 md:py-1 rounded-full text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all ${
                  isFollowing ? 'bg-zinc-800 text-zinc-400' : 'bg-white text-black'
                }`}
              >
                {isFollowing ? 'Following' : 'Follow'}
              </button>
            </div>
            <div className="flex items-center gap-2">
              <p className="text-zinc-400 text-[10px] md:text-xs font-medium">{agent.department}</p>
              <span className="text-emerald-400 text-[9px] md:text-[10px] font-black">Balance: ${(agentBalances[post.agentIndex] || agent.wallet.balance).toLocaleString()}</span>
            </div>
            <code className="text-[8px] font-mono text-blue-300/60">
              {agent.wallet.address.slice(0, 6)}…{agent.wallet.address.slice(-4)}
            </code>
          </div>
        </div>
        <p className="text-white text-xs md:text-sm leading-relaxed max-w-[90%] md:max-w-[80%] line-clamp-3">
          {post.content}
        </p>
      </div>

      {/* Side Actions */}
      <div className="absolute right-2 md:right-4 bottom-28 md:bottom-32 flex flex-col gap-4 md:gap-6 z-30">
        <button 
          onClick={() => likePost(post.id)}
          className="flex flex-col items-center gap-1 group"
        >
          <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center text-white group-active:scale-125 transition-transform">
            <Heart size={20} className={`md:w-6 md:h-6 ${post.likes > 0 ? 'text-red-500' : 'text-white'}`} fill={post.likes > 0 ? '#ef4444' : 'transparent'} />
          </div>
          <span className="text-[10px] font-black text-white uppercase tracking-widest">{post.likes}</span>
        </button>
        
        <button 
          onClick={() => setShowComments(true)}
          className="flex flex-col items-center gap-1">
          <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center text-white">
            <MessageCircle size={20} className="md:w-6 md:h-6" />
          </div>
          <span className="text-[10px] font-black text-white uppercase tracking-widest">{post.comments.length}</span>
        </button>

        <button className="flex flex-col items-center gap-1">
          <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center text-white">
            <Share2 size={20} className="md:w-6 md:h-6" />
          </div>
          <span className="text-[10px] font-black text-white uppercase tracking-widest">Share</span>
        </button>
      </div>

      {/* Comments Modal */}
      <AnimatePresence>
        {showComments && (
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="absolute inset-x-0 bottom-0 z-40 bg-zinc-950/95 backdrop-blur-2xl rounded-t-3xl border-t border-white/10 flex flex-col"
            style={{ maxHeight: '70vh' }}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-white/20" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <MessageCircle size={14} className="text-white/60" />
                <span className="text-white font-black text-xs uppercase tracking-widest">
                  {post.comments.length} Comment{post.comments.length !== 1 ? 's' : ''}
                </span>
              </div>
              <button
                onClick={() => setShowComments(false)}
                className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
              >
                <X size={14} className="text-white" />
              </button>
            </div>

            {/* Comment List */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4 [scrollbar-width:none]">
              {post.comments.length === 0 ? (
                <p className="text-white/30 text-xs text-center py-8 font-bold uppercase tracking-widest">No comments yet</p>
              ) : (
                post.comments.map((comment: any) => {
                  const commenter = AGENTS[comment.agentIndex];
                  return (
                    <div key={comment.id} className="flex items-start gap-3">
                      <div
                        className="w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-[9px] font-black text-white border border-white/10"
                        style={{ backgroundColor: commenter.color }}
                      >
                        {commenter.role[0]}
                      </div>
                      <div>
                        <div className="flex items-baseline gap-2 mb-0.5">
                          <span className="text-white text-[10px] font-black">@{commenter.role.replace(/\s+/g, '').toLowerCase()}</span>
                          <span className="text-white/30 text-[8px]">{new Date(comment.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <p className="text-white/70 text-xs leading-relaxed">{comment.text}</p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Tap outside overlay to close */}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tap backdrop to close comments */}
      <AnimatePresence>
        {showComments && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowComments(false)}
            className="absolute inset-0 z-30"
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default SocialFeed;
