import React, { useState, useEffect } from 'react';
import { useAccount, useConnect, useDisconnect, useSwitchChain, useBalance, useSignMessage } from 'wagmi';
import { base } from 'wagmi/chains';
import { arcTestnet } from '../wagmi.config';
import { useStore } from '../store/useStore';
import { signInWithBase } from '../services/baseAccountService';
import { walletSignIn } from '../services/apiService';
import { formatUnits } from 'viem';
import {
  X,
  Wallet,
  Check,
  Copy,
  ExternalLink,
  LogOut,
  RefreshCw,
  Zap,
  ShieldCheck,
  AlertCircle,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface WalletConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const WalletConnectModal: React.FC<WalletConnectModalProps> = ({ isOpen, onClose }) => {
  const { userAddress, setUserAddress } = useStore();
  const { address, isConnected, chainId, connector } = useAccount();
  const { connectAsync, connectors, isPending } = useConnect();
  const { disconnectAsync } = useDisconnect();
  const { switchChainAsync } = useSwitchChain();
  const { signMessageAsync } = useSignMessage();
  const { data: balanceData, refetch: refetchBalance } = useBalance({
    address: address ?? (userAddress as `0x${string}` | undefined),
  });

  const [connectingWalletId, setConnectingWalletId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'connect' | 'details'>(
    isConnected || userAddress ? 'details' : 'connect'
  );

  // Sync connected wagmi account to store
  useEffect(() => {
    if (address && address !== userAddress) {
      setUserAddress(address);
    }
  }, [address, userAddress, setUserAddress]);

  // Adjust default view when connection status changes
  useEffect(() => {
    if (isConnected || userAddress) {
      setActiveTab('details');
    } else {
      setActiveTab('connect');
    }
  }, [isConnected, userAddress]);

  // Reset errors when modal opens
  useEffect(() => {
    if (isOpen) {
      setError(null);
      setConnectingWalletId(null);
    }
  }, [isOpen]);

  const handleCopy = () => {
    const target = address || userAddress;
    if (target) {
      navigator.clipboard.writeText(target);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDisconnect = async () => {
    try {
      if (isConnected) {
        await disconnectAsync();
      }
      setUserAddress(null);
      onClose();
    } catch (err) {
      console.warn('[Wallet] Disconnect error:', err);
      setUserAddress(null);
      onClose();
    }
  };

  const handleSwitchNetwork = async (targetChainId: 8453 | 5042002) => {
    setError(null);
    try {
      if (switchChainAsync) {
        await switchChainAsync({ chainId: targetChainId });
      } else if (typeof window !== 'undefined' && (window as any).ethereum) {
        const hexChainId = `0x${targetChainId.toString(16)}`;
        try {
          await (window as any).ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: hexChainId }],
          });
        } catch (switchError: any) {
          // If chain is not added (error code 4902), add it
          if (switchError?.code === 4902 && targetChainId === arcTestnet.id) {
            await (window as any).ethereum.request({
              method: 'wallet_addEthereumChain',
              params: [
                {
                  chainId: hexChainId,
                  chainName: 'Arc Testnet',
                  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
                  rpcUrls: ['https://rpc.testnet.arc-node.thecanteenapp.com/v1/public'],
                  blockExplorerUrls: ['https://testnet.arcscan.app'],
                },
              ],
            });
          } else {
            throw switchError;
          }
        }
      }
      refetchBalance();
    } catch (err: any) {
      const msg = err?.message || 'Failed to switch network';
      setError(msg);
    }
  };

  // 1. Connect with Base Account (Passkey / Smart Wallet)
  const connectBaseAccount = async () => {
    setConnectingWalletId('base-account');
    setError(null);
    try {
      // Find baseAccount connector or fallback to SDK
      const baseConnector = connectors.find(
        (c) =>
          c.id === 'baseAccount' ||
          c.id === 'coinbaseWallet' ||
          c.name.toLowerCase().includes('base')
      );

      if (baseConnector) {
        const result = await connectAsync({
          connector: baseConnector,
          chainId: base.id,
        });
        if (result.accounts?.[0]) {
          const acc = result.accounts[0];
          setUserAddress(acc);
          try {
            await walletSignIn(acc, base.id, (msg: string) =>
              signMessageAsync({ message: msg, account: acc })
            );
          } catch {
            // Offline fallback
          }
        }
      } else {
        // Fallback directly to baseAccountService SDK
        const result = await signInWithBase();
        if (result?.address) {
          setUserAddress(result.address);
        }
      }
      onClose();
    } catch (err: any) {
      const msg = err?.message || String(err);
      if (!msg.toLowerCase().includes('reject') && !msg.toLowerCase().includes('cancel')) {
        setError(`Base Account connection: ${msg}`);
      }
    } finally {
      setConnectingWalletId(null);
    }
  };

  // 2. Connect with MetaMask
  const connectMetaMask = async () => {
    setConnectingWalletId('metamask');
    setError(null);
    try {
      const metaMaskConnector = connectors.find(
        (c) =>
          c.id === 'metaMask' ||
          c.id === 'io.metamask' ||
          c.name.toLowerCase().includes('metamask')
      );

      const fallbackInjected = connectors.find((c) => c.id === 'injected');
      const targetConnector = metaMaskConnector || fallbackInjected;

      if (!targetConnector) {
        throw new Error('MetaMask is not detected. Please install the MetaMask browser extension.');
      }

      const result = await connectAsync({
        connector: targetConnector,
        chainId: base.id,
      });

      if (result.accounts?.[0]) {
        const acc = result.accounts[0];
        setUserAddress(acc);
        try {
          await walletSignIn(acc, base.id, (msg: string) =>
            signMessageAsync({ message: msg, account: acc })
          );
        } catch {
          // Offline fallback
        }
      }
      onClose();
    } catch (err: any) {
      const msg = err?.message || String(err);
      if (!msg.toLowerCase().includes('reject') && !msg.toLowerCase().includes('cancel')) {
        if (msg.toLowerCase().includes('not found') || msg.toLowerCase().includes('provider')) {
          setError('MetaMask extension was not detected. Please install MetaMask or open via MetaMask Mobile.');
        } else {
          setError(msg);
        }
      }
    } finally {
      setConnectingWalletId(null);
    }
  };

  // 3. Connect with Arc Wallet (Arc Testnet)
  const connectArcWallet = async () => {
    setConnectingWalletId('arc-wallet');
    setError(null);
    try {
      // Connect with available injected or metamask provider and switch chain to Arc Testnet
      const injectedConn =
        connectors.find((c) => c.id === 'injected') ||
        connectors.find((c) => c.id === 'metaMask') ||
        connectors[0];

      if (!injectedConn) {
        throw new Error('No compatible browser wallet found. Please install MetaMask or Arc-compatible wallet.');
      }

      const result = await connectAsync({
        connector: injectedConn,
        chainId: arcTestnet.id,
      });

      const connectedAddr = result.accounts?.[0] || address;
      if (connectedAddr) {
        setUserAddress(connectedAddr);
      }

      // Prompt switch to Arc Testnet if not on it
      try {
        await handleSwitchNetwork(arcTestnet.id);
      } catch (switchErr) {
        console.warn('[ArcWallet] Network switch notice:', switchErr);
      }

      onClose();
    } catch (err: any) {
      const msg = err?.message || String(err);
      if (!msg.toLowerCase().includes('reject') && !msg.toLowerCase().includes('cancel')) {
        setError(`Arc Wallet connection: ${msg}`);
      }
    } finally {
      setConnectingWalletId(null);
    }
  };

  if (!isOpen) return null;

  const currentDisplayAddress = address || userAddress;
  const isArcChain = chainId === arcTestnet.id;
  const formattedBalance = balanceData
    ? `${Number(formatUnits(balanceData.value, balanceData.decimals)).toFixed(4)} ${balanceData.symbol}`
    : '0.0000 ETH';

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 sm:p-6"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 10 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 10 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="relative w-full max-w-md bg-zinc-950 border border-white/10 rounded-3xl shadow-2xl overflow-hidden text-white"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-5 sm:p-6 border-b border-white/10 bg-white/[0.02]">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/20">
                <Wallet size={18} className="text-white" />
              </div>
              <div>
                <h3 className="text-base font-black tracking-tight text-white">
                  {currentDisplayAddress ? 'Connected Wallet' : 'Connect Wallet'}
                </h3>
                <p className="text-[11px] text-zinc-400 font-medium">
                  {currentDisplayAddress ? 'Manage connection & networks' : 'Select a provider to continue'}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white border border-white/10 transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          {/* Body */}
          <div className="p-5 sm:p-6 space-y-4">
            {error && (
              <div className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-start gap-2.5">
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                <span className="leading-relaxed">{error}</span>
              </div>
            )}

            {currentDisplayAddress ? (
              /* ─── CONNECTED ACCOUNT VIEW ─── */
              <div className="space-y-4">
                {/* Address & Status Pill */}
                <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                      Account Identity
                    </span>
                    <span className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full border border-emerald-400/20">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      Connected
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2 bg-black/50 p-2.5 rounded-xl border border-white/5">
                    <code className="text-xs font-mono text-zinc-200 truncate">
                      {currentDisplayAddress}
                    </code>
                    <button
                      onClick={handleCopy}
                      className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors flex items-center gap-1 text-[10px] font-bold shrink-0"
                      title="Copy address"
                    >
                      {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                      <span>{copied ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>

                  {/* Balance Display */}
                  <div className="flex items-center justify-between text-xs pt-1">
                    <span className="text-zinc-400">Balance:</span>
                    <span className="font-mono font-bold text-white">
                      {formattedBalance}
                    </span>
                  </div>
                </div>

                {/* Network Switcher */}
                <div className="space-y-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                    Active Network
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    {/* Base Mainnet button */}
                    <button
                      onClick={() => handleSwitchNetwork(base.id)}
                      className={`p-3 rounded-2xl border text-left transition-all flex flex-col gap-1 ${
                        chainId === base.id || !isArcChain
                          ? 'bg-blue-600/15 border-blue-500/40 text-white'
                          : 'bg-white/[0.02] border-white/10 text-zinc-400 hover:text-white hover:bg-white/[0.05]'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <div className="w-3 h-3 rounded-sm bg-blue-500" />
                          <span className="text-xs font-black">Base Mainnet</span>
                        </div>
                        {(chainId === base.id || !isArcChain) && (
                          <Check size={12} className="text-blue-400" />
                        )}
                      </div>
                      <span className="text-[10px] text-zinc-400">Chain ID 8453</span>
                    </button>

                    {/* Arc Testnet button */}
                    <button
                      onClick={() => handleSwitchNetwork(arcTestnet.id)}
                      className={`p-3 rounded-2xl border text-left transition-all flex flex-col gap-1 ${
                        isArcChain
                          ? 'bg-cyan-500/15 border-cyan-500/40 text-white'
                          : 'bg-white/[0.02] border-white/10 text-zinc-400 hover:text-white hover:bg-white/[0.05]'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <div className="w-3 h-3 rounded-full bg-cyan-400" />
                          <span className="text-xs font-black">Arc Testnet</span>
                        </div>
                        {isArcChain && <Check size={12} className="text-cyan-400" />}
                      </div>
                      <span className="text-[10px] text-zinc-400">Chain ID 5042002</span>
                    </button>
                  </div>
                </div>

                {/* External Links & Actions */}
                <div className="pt-2 flex flex-col gap-2">
                  <a
                    href={
                      isArcChain
                        ? `https://testnet.arcscan.app/address/${currentDisplayAddress}`
                        : `https://basescan.org/address/${currentDisplayAddress}`
                    }
                    target="_blank"
                    rel="noreferrer noopener"
                    className="w-full py-2.5 px-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-zinc-300 hover:text-white border border-white/10 transition-all flex items-center justify-between text-xs font-bold"
                  >
                    <span className="flex items-center gap-2">
                      <ExternalLink size={14} />
                      View on {isArcChain ? 'ArcScan Explorer' : 'BaseScan Explorer'}
                    </span>
                    <ChevronRight size={14} className="text-zinc-500" />
                  </a>

                  <button
                    onClick={handleDisconnect}
                    className="w-full py-2.5 px-3 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition-all flex items-center justify-center gap-2 text-xs font-bold mt-1"
                  >
                    <LogOut size={14} />
                    Disconnect Wallet
                  </button>
                </div>
              </div>
            ) : (
              /* ─── WALLET OPTIONS GRID ─── */
              <div className="space-y-3">
                {/* 1. Base Account (Coinbase / Passkey) */}
                <button
                  onClick={connectBaseAccount}
                  disabled={isPending || connectingWalletId !== null}
                  className="w-full group relative p-4 rounded-2xl bg-gradient-to-r from-blue-900/20 via-blue-800/10 to-transparent hover:from-blue-900/30 border border-blue-500/30 hover:border-blue-400/60 transition-all text-left flex items-center justify-between disabled:opacity-50"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-11 h-11 rounded-2xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-600/30 shrink-0 group-hover:scale-105 transition-transform">
                      {/* Base Blue Square Logo */}
                      <div className="w-5 h-5 rounded bg-white flex items-center justify-center">
                        <div className="w-3 h-3 rounded-xs bg-blue-600" />
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-black text-white">Base Account</span>
                        <span className="text-[9px] font-black uppercase tracking-wider text-blue-400 bg-blue-400/10 border border-blue-400/20 px-2 py-0.5 rounded-md">
                          Smart Wallet
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-400 mt-0.5">
                        Passkey & instant onboarding · Zero seed phrases
                      </p>
                    </div>
                  </div>
                  {connectingWalletId === 'base-account' ? (
                    <RefreshCw size={16} className="text-blue-400 animate-spin" />
                  ) : (
                    <ChevronRight size={16} className="text-zinc-500 group-hover:text-white transition-colors" />
                  )}
                </button>

                {/* 2. MetaMask */}
                <button
                  onClick={connectMetaMask}
                  disabled={isPending || connectingWalletId !== null}
                  className="w-full group relative p-4 rounded-2xl bg-gradient-to-r from-amber-900/20 via-orange-800/10 to-transparent hover:from-amber-900/30 border border-amber-500/30 hover:border-amber-400/60 transition-all text-left flex items-center justify-between disabled:opacity-50"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-orange-500/20 shrink-0 group-hover:scale-105 transition-transform">
                      {/* Fox Icon representation */}
                      <span className="text-lg">🦊</span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-black text-white">MetaMask</span>
                        <span className="text-[9px] font-black uppercase tracking-wider text-amber-400 bg-amber-400/10 border border-amber-400/20 px-2 py-0.5 rounded-md">
                          Extension / Mobile
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-400 mt-0.5">
                        Connect with MetaMask browser extension or mobile
                      </p>
                    </div>
                  </div>
                  {connectingWalletId === 'metamask' ? (
                    <RefreshCw size={16} className="text-amber-400 animate-spin" />
                  ) : (
                    <ChevronRight size={16} className="text-zinc-500 group-hover:text-white transition-colors" />
                  )}
                </button>

                {/* 3. Arc Wallet / Arc Testnet */}
                <button
                  onClick={connectArcWallet}
                  disabled={isPending || connectingWalletId !== null}
                  className="w-full group relative p-4 rounded-2xl bg-gradient-to-r from-cyan-900/20 via-purple-900/10 to-transparent hover:from-cyan-900/30 border border-cyan-500/30 hover:border-cyan-400/60 transition-all text-left flex items-center justify-between disabled:opacity-50"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center shadow-lg shadow-cyan-500/20 shrink-0 group-hover:scale-105 transition-transform">
                      <Zap size={20} className="text-white" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-black text-white">Arc Wallet</span>
                        <span className="text-[9px] font-black uppercase tracking-wider text-cyan-400 bg-cyan-400/10 border border-cyan-400/20 px-2 py-0.5 rounded-md">
                          Chain 5042002
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-400 mt-0.5">
                        Arc Testnet autonomous agents & gasless USDC
                      </p>
                    </div>
                  </div>
                  {connectingWalletId === 'arc-wallet' ? (
                    <RefreshCw size={16} className="text-cyan-400 animate-spin" />
                  ) : (
                    <ChevronRight size={16} className="text-zinc-500 group-hover:text-white transition-colors" />
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Footer Security Badge */}
          <div className="p-4 bg-white/[0.02] border-t border-white/5 flex items-center justify-between text-[11px] text-zinc-500">
            <span className="flex items-center gap-1.5">
              <ShieldCheck size={14} className="text-emerald-400" />
              Non-custodial & secure
            </span>
            <span className="text-zinc-400 font-mono">Base & Arc Protocol</span>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
