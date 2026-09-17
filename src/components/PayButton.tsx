import React, { useState } from 'react';
import { BasePayButton } from '@base-org/account-ui/react';
import { PaymentOptions, makePayment } from '../services/baseAccountService';

interface PaymentResult {
  success: boolean;
  transactionHash?: string;
  error?: string;
  payerInfoResponses?: Record<string, unknown>;
}

interface PayButtonProps {
  amount: string;
  to: string;
  testnet?: boolean;
  payerInfo?: PaymentOptions['payerInfo'];
  colorScheme?: 'light' | 'dark' | 'system';
  size?: 'small' | 'medium' | 'large';
  variant?: 'solid' | 'outline';
  disabled?: boolean;
  onPaymentResult?: (result: PaymentResult) => void;
  onClick?: () => void;
}

const PayButton: React.FC<PayButtonProps> = ({
  amount,
  to,
  testnet = false,
  payerInfo,
  colorScheme = 'light',
  disabled = false,
  onPaymentResult,
  onClick,
}) => {
  const [paying, setPaying] = useState(false);

  const handleClick = async () => {
    if (disabled || paying) return;
    onClick?.();
    setPaying(true);
    try {
      const result = await makePayment({
        amount,
        to,
        testnet,
        payerInfo,
      });
      onPaymentResult?.({
        success: result.status === 'success' || result.status === 'completed' || !!result.id,
        transactionHash: result.id,
        payerInfoResponses: result.payerInfoResponses,
      });
    } catch (err: unknown) {
      onPaymentResult?.({
        success: false,
        error: err instanceof Error ? err.message : 'Payment failed',
      });
    } finally {
      setPaying(false);
    }
  };

  return (
    <div className="w-full flex justify-center">
      <BasePayButton
        colorScheme={colorScheme}
        onClick={handleClick}
      />
    </div>
  );
};

export default PayButton;

