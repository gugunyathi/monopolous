import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import { signInWithBase } from '../services/baseAccountService';
import { walletSignIn } from '../services/apiService';
import { useAccount, useSignMessage, usePublicClient } from 'wagmi';
import { createSiweMessage, generateSiweNonce } from 'viem/siwe';

const SignInButton: React.FC = () => {
  const { userAddress, setUserAddress } = useStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);


  const { address, chainId, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const publicClient = usePublicClient();

  const handleClick = async () => {
    if (userAddress) {
      setUserAddress(null);
      return;
    }

    if (!isConnected || !address || !chainId || !publicClient) {
      setError('Please connect your wallet first');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const nonce = generateSiweNonce();
      const message = createSiweMessage({
        address,
        chainId,
        domain: window.location.host,
        nonce,
        uri: window.location.origin,
        version: '1',
      });

      const signature = await signMessageAsync({ message, account: address });
      const valid = await publicClient.verifySiweMessage({ message, signature });

      if (!valid) {
        setError('Signature verification failed');
        setLoading(false);
        return;
      }

      setUserAddress(address);

      // Authenticate with backend (non-blocking — game works without it)
      try {
        await walletSignIn(address, async (msg: string) => {
          return await signMessageAsync({ message: msg, account: address });
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
        disabled={loading || !isConnected}
        style={{ pointerEvents: 'auto', cursor: loading ? 'wait' : 'pointer' }}
        className="flex items-center gap-2 bg-white border border-black/10 rounded-xl px-4 py-2.5 shadow-lg hover:bg-blue-50 transition-all disabled:opacity-60"
      >
        {/* Base blue square logo */}
        <div className="w-4 h-4 rounded-sm bg-blue-600 shrink-0" />
        <span className="text-sm font-semibold text-zinc-900 whitespace-nowrap">
          {!isConnected ? 'Connect Wallet' : loading ? 'Signing…' : 'Sign in with Ethereum'}
        </span>
      </button>
      {error && (
        <span className="text-[9px] text-red-500 font-bold max-w-[180px] text-right">{error}</span>
      )}
    </div>
  );
};

export default SignInButton;
