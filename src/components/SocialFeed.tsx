
import React, { useEffect, useRef } from 'react';
import { useStore } from '../store/useStore';
import { AGENTS } from '../data/agents';
import { Heart, MessageCircle, Share2, UserPlus, UserCheck, TrendingUp, TrendingDown } from 'lucide-react';
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
              <span className="text-emerald-400 text-[9px] md:text-[10px] font-black">Balance: ${(agentBalances[post.agentIndex] || 1500).toLocaleString()}</span>
            </div>
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
            <Heart size={20} className="md:w-6 md:h-6" fill={post.likes > 0 ? '#ef4444' : 'transparent'} className={post.likes > 0 ? 'text-red-500' : 'text-white'} />
          </div>
          <span className="text-[10px] font-black text-white uppercase tracking-widest">{post.likes}</span>
        </button>
        
        <button className="flex flex-col items-center gap-1">
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
    </div>
  );
};

export default SocialFeed;
