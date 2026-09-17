import { http, createConfig, createStorage, cookieStorage } from 'wagmi';
import { base } from 'wagmi/chains';
import { baseAccount, injected, metaMask, coinbaseWallet } from 'wagmi/connectors';
import { defineChain } from 'viem';

export const arcTestnet = defineChain({
  id: 5042002,
  name: 'Arc Testnet',
  nativeCurrency: {
    name: 'USDC',
    symbol: 'USDC',
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: [
        'https://rpc.testnet.arc-node.thecanteenapp.com/v1/public',
        'https://rpc.testnet.arc.network',
      ],
    },
    public: {
      http: [
        'https://rpc.testnet.arc-node.thecanteenapp.com/v1/public',
        'https://rpc.testnet.arc.network',
      ],
    },
  },
  blockExplorers: {
    default: {
      name: 'ArcScan',
      url: 'https://testnet.arcscan.app',
    },
  },
  testnet: true,
});

export const config = createConfig({
  chains: [base, arcTestnet],
  connectors: [
    baseAccount({
      appName: 'Monopolous',
    }),
    metaMask({
      dappMetadata: {
        name: 'Monopolous',
      },
    }),
    injected({
      shimDisconnect: true,
    }),
    coinbaseWallet({
      appName: 'Monopolous',
    }),
  ],
  storage: createStorage({ storage: cookieStorage }),
  ssr: true,
  transports: {
    [base.id]: http(),
    [arcTestnet.id]: http('https://rpc.testnet.arc-node.thecanteenapp.com/v1/public'),
  },
});

declare module 'wagmi' {
  interface Register {
    config: typeof config;
  }
}

