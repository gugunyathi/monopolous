import React, { useState } from 'react';
import { signInWithBase } from '../services/baseAccountService';
import { useStore } from '../store/useStore';
import { walletSignIn, clearToken, getToken, getMe, setSessionId } from '../services/apiService';

const SignInButton: React.FC = () => {
  const { userAddress, setUserAddress } = useStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClick = async () => {
    if (userAddress) {
      setUserAddress(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { address } = await signInWithBase();
      setUserAddress(address);

      // Authenticate with backend (non-blocking — game works without it)
      try {
        await walletSignIn(address, async (message: string) => {
          // Re-use the ethers provider from base account SDK for signing
          const provider = (window as unknown as Record<string, unknown>).__baseProvider;
          if (provider && typeof (provider as Record<string, unknown>).request === 'function') {
            return (provider as { request: (args: { method: string; params: unknown[] }) => Promise<string> })
              .request({ method: 'personal_sign', params: [message, address] });
          }
          throw new Error('No wallet provider for signing');
        });
      } catch {
        console.warn('[Auth] Backend sign-in unavailable — continuing in offline mode');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.toLowerCase().includes('reject') && !msg.toLowerCase().includes('cancel')) {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  if (userAddress) {
    return (
      <button
        onClick={handleClick}
        style={{ pointerEvents: 'auto', cursor: 'pointer' }}
        className="flex items-center gap-2 bg-white/90 backdrop-blur-md border border-black/10 rounded-xl px-3 py-2 shadow-lg hover:bg-white transition-all"
      >
        <div className="w-2 h-2 rounded-full bg-blue-600" />
        <span className="text-[10px] font-black uppercase tracking-widest text-zinc-800">
          {userAddress.slice(0, 6)}…{userAddress.slice(-4)}
        </span>
      </button>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1" style={{ pointerEvents: 'auto' }}>
      <button
        onClick={handleClick}
        disabled={loading}
        style={{ pointerEvents: 'auto', cursor: loading ? 'wait' : 'pointer' }}
        className="flex items-center gap-2 bg-white border border-black/10 rounded-xl px-4 py-2.5 shadow-lg hover:bg-blue-50 transition-all disabled:opacity-60"
      >
        {/* Base blue square logo */}
        <div className="w-4 h-4 rounded-sm bg-blue-600 shrink-0" />
        <span className="text-sm font-semibold text-zinc-900 whitespace-nowrap">
          {loading ? 'Connecting…' : 'Sign in with Base'}
        </span>
      </button>
      {error && (
        <span className="text-[9px] text-red-500 font-bold max-w-[180px] text-right">{error}</span>
      )}
    </div>
  );
};

export default SignInButton;
