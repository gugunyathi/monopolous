import React from 'react';
import { BasePayButton } from '@base-org/account-ui/react';
import { PaymentOptions } from '../services/baseAccountService';
import { getBuilderCodeDataSuffix } from '../constants/builderCode';

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
  size = 'medium',
  variant = 'solid',
  disabled = false,
  onPaymentResult,
  onClick,
}) => {
  const dataSuffix = getBuilderCodeDataSuffix();

  return (
    <BasePayButton
      paymentOptions={{
        amount,
        to,
        testnet,
        ...(dataSuffix ? { dataSuffix } : {}),
        ...(payerInfo ? { payerInfo } : {}),
      }}
      colorScheme={colorScheme}
      size={size}
      variant={variant}
      disabled={disabled}
      onClick={onClick}
      onPaymentResult={onPaymentResult}
    />
  );
};

export default PayButton;
