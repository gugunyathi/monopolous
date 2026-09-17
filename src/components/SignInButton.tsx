import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import { useAccount } from 'wagmi';
import { arcTestnet } from '../wagmi.config';
import { WalletConnectModal } from './WalletConnectModal';
import { Wallet, Zap, ChevronDown } from 'lucide-react';

const SignInButton: React.FC = () => {
  const { userAddress } = useStore();
  const { address, isConnected, chainId } = useAccount();
  const [modalOpen, setModalOpen] = useState(false);

  const currentAddress = address || userAddress;
  const isArcChain = chainId === arcTestnet.id;

  return (
    <>
      <div className="flex items-center gap-2" style={{ pointerEvents: 'auto' }}>
        {currentAddress ? (
          <button
            onClick={() => setModalOpen(true)}
            style={{ pointerEvents: 'auto', cursor: 'pointer' }}
            className="group flex items-center gap-2 bg-white/90 hover:bg-white backdrop-blur-md border border-black/10 rounded-2xl px-3.5 py-2 shadow-lg hover:shadow-xl transition-all"
          >
            {/* Chain badge indicator */}
            {isArcChain ? (
              <div className="flex items-center gap-1 bg-cyan-500/10 border border-cyan-500/30 px-1.5 py-0.5 rounded-md text-[9px] font-black text-cyan-600 uppercase tracking-wider">
                <Zap size={10} className="text-cyan-500" />
                <span>Arc</span>
              </div>
            ) : (
              <div className="flex items-center gap-1 bg-blue-500/10 border border-blue-500/30 px-1.5 py-0.5 rounded-md text-[9px] font-black text-blue-600 uppercase tracking-wider">
                <div className="w-2 h-2 rounded-xs bg-blue-600" />
                <span>Base</span>
              </div>
            )}

            {/* Address Pill */}
            <span className="text-xs font-mono font-bold text-zinc-800">
              {currentAddress.slice(0, 6)}…{currentAddress.slice(-4)}
            </span>

            <ChevronDown size={14} className="text-zinc-400 group-hover:text-zinc-600 transition-colors" />
          </button>
        ) : (
          <button
            onClick={() => setModalOpen(true)}
            style={{ pointerEvents: 'auto', cursor: 'pointer' }}
            className="group flex items-center gap-2.5 bg-zinc-900 hover:bg-black text-white border border-white/10 rounded-2xl px-4 py-2.5 shadow-xl hover:shadow-2xl transition-all active:scale-95"
          >
            <div className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 rounded-xs bg-blue-500" />
              <div className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
            </div>
            <span className="text-xs font-black uppercase tracking-wider whitespace-nowrap">
              Connect Wallet
            </span>
            <Wallet size={14} className="text-zinc-400 group-hover:text-white transition-colors" />
          </button>
        )}
      </div>

      {/* Wallet Connect & Management Modal */}
      <WalletConnectModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  );
};

export default SignInButton;

