import { createBaseAccountSDK, pay, getPaymentStatus } from '@base-org/account';

// Initialize the Base Account SDK
const sdk = createBaseAccountSDK({
  appName: 'Monopolous',
  appLogoUrl: 'https://www.your-domain.com/icon.png',
});

const provider = sdk.getProvider();

// --- Sign In with Base ---

function generateNonce(): string {
  return window.crypto.randomUUID().replace(/-/g, '');
}

export interface SignInResult {
  address: string;
  message: string;
  signature: string;
}

export async function signInWithBase(): Promise<SignInResult> {
  const nonce = generateNonce();

  const response = await provider.request({
    method: 'wallet_connect',
    params: [
      {
        version: '1',
        capabilities: {
          signInWithEthereum: {
            nonce,
            chainId: '0x2105', // Base Mainnet (8453)
          },
        },
      },
    ],
  }) as {
    accounts: Array<{
      address: string;
      capabilities: {
        signInWithEthereum: { message: string; signature: string };
      };
    }>;
  };

  const { address } = response.accounts[0];
  const { message, signature } = response.accounts[0].capabilities.signInWithEthereum;

  return { address, message, signature };
}

// --- Base Pay ---

export interface PayerInfoRequest {
  type: 'email' | 'name' | 'phoneNumber' | 'physicalAddress' | 'onchainAddress';
  optional?: boolean;
}

export interface PayerInfo {
  requests: PayerInfoRequest[];
  callbackURL?: string;
}

export interface PaymentOptions {
  amount: string;       // USD amount e.g. "5.00"
  to: string;           // recipient address
  testnet?: boolean;    // true = Base Sepolia, false/omit = Mainnet
  payerInfo?: PayerInfo;
}

export interface PaymentResult {
  id: string;
  status: string;
  payerInfoResponses?: Record<string, unknown>;
}

export async function makePayment(options: PaymentOptions): Promise<PaymentResult> {
  const result = await pay({
    amount: options.amount,
    to: options.to,
    testnet: options.testnet ?? false,
    ...(options.payerInfo ? { payerInfo: options.payerInfo } : {}),
  });

  const { status } = await getPaymentStatus({
    id: result.id,
    testnet: options.testnet ?? false,
  });

  return {
    id: result.id,
    status,
    payerInfoResponses: (result as unknown as Record<string, unknown>).payerInfoResponses as Record<string, unknown> | undefined,
  };
}
