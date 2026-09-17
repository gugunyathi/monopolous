import { BoardTile } from '../../types';

export interface ExchangeBranding {
  name: string;
  ticker: string;
  primaryColor: string;
  secondaryColor: string;
  iconSymbol: string;
  badgeText: string;
}

export function getExchangeBranding(tile: BoardTile): ExchangeBranding {
  const name = tile.name.toUpperCase();
  
  if (name.includes('UNISWAP')) {
    return { name: 'Uniswap', ticker: 'UNI', primaryColor: '#ff007a', secondaryColor: '#990048', iconSymbol: '🦄', badgeText: 'DEX #1' };
  }
  if (name.includes('BINANCE')) {
    return { name: 'Binance', ticker: 'BNB', primaryColor: '#f3ba2f', secondaryColor: '#b28318', iconSymbol: '🟡', badgeText: 'CEX LEADER' };
  }
  if (name.includes('COINBASE')) {
    return { name: 'Coinbase', ticker: 'COIN', primaryColor: '#0052ff', secondaryColor: '#0033b3', iconSymbol: '🔵', badgeText: 'NASDAQ CEX' };
  }
  if (name.includes('HYPERLIQUID')) {
    return { name: 'Hyperliquid', ticker: 'HYPE', primaryColor: '#10b981', secondaryColor: '#047857', iconSymbol: '⚡', badgeText: 'PERPS DEX' };
  }
  if (name.includes('AERODROME')) {
    return { name: 'Aerodrome', ticker: 'AERO', primaryColor: '#0052ff', secondaryColor: '#1e3a8a', iconSymbol: '✈️', badgeText: 'BASE AMM' };
  }
  if (name.includes('BYBIT')) {
    return { name: 'Bybit', ticker: 'BIT', primaryColor: '#f7931a', secondaryColor: '#b45309', iconSymbol: '🚀', badgeText: 'DERIVATIVES' };
  }
  if (name.includes('OKX')) {
    return { name: 'OKX', ticker: 'OKB', primaryColor: '#1a1a1a', secondaryColor: '#333333', iconSymbol: '⭕', badgeText: 'GLOBAL CEX' };
  }
  if (name.includes('KRAKEN')) {
    return { name: 'Kraken', ticker: 'KRAK', primaryColor: '#5741d9', secondaryColor: '#3730a3', iconSymbol: '🐙', badgeText: 'SECURE CEX' };
  }
  if (name.includes('GATE.IO')) {
    return { name: 'Gate.io', ticker: 'GT', primaryColor: '#23527c', secondaryColor: '#1e3a8a', iconSymbol: '🚪', badgeText: 'ALT GEMS' };
  }
  if (name.includes('AAVE')) {
    return { name: 'Aave', ticker: 'AAVE', primaryColor: '#b6509e', secondaryColor: '#701a75', iconSymbol: '👻', badgeText: 'LENDING' };
  }
  if (name.includes('CURVE')) {
    return { name: 'Curve', ticker: 'CRV', primaryColor: '#00d1ff', secondaryColor: '#0284c7', iconSymbol: '🌊', badgeText: 'STABLE AMM' };
  }
  if (name.includes('SOLANA')) {
    return { name: 'Solana', ticker: 'SOL', primaryColor: '#14f195', secondaryColor: '#047857', iconSymbol: '🟣', badgeText: 'L1 HIGH-TPS' };
  }
  if (name.includes('ETHEREUM')) {
    return { name: 'Ethereum', ticker: 'ETH', primaryColor: '#627eea', secondaryColor: '#3b82f6', iconSymbol: '💎', badgeText: 'SMART L1' };
  }
  if (name.includes('BITCOIN')) {
    return { name: 'Bitcoin', ticker: 'BTC', primaryColor: '#f7931a', secondaryColor: '#d97706', iconSymbol: '₿', badgeText: 'STORE OF VALUE' };
  }
  if (name.includes('OPENSEA')) {
    return { name: 'OpenSea', ticker: 'SEA', primaryColor: '#2081e2', secondaryColor: '#1d4ed8', iconSymbol: '⛵', badgeText: 'NFT MARKET' };
  }
  if (name.includes('BLUR')) {
    return { name: 'Blur', ticker: 'BLUR', primaryColor: '#ff6b00', secondaryColor: '#c2410c', iconSymbol: '🔥', badgeText: 'PRO NFT' };
  }
  if (name.includes('JUPITER')) {
    return { name: 'Jupiter', ticker: 'JUP', primaryColor: '#c792ea', secondaryColor: '#9333ea', iconSymbol: '🪐', badgeText: 'SOLANA DEX' };
  }
  if (name.includes('GMX')) {
    return { name: 'GMX', ticker: 'GMX', primaryColor: '#ef4444', secondaryColor: '#b91c1c', iconSymbol: '📈', badgeText: 'PERP LEVERAGE' };
  }

  // Default fallback
  return {
    name: tile.name,
    ticker: 'EXCHANGE',
    primaryColor: tile.color || '#3b82f6',
    secondaryColor: '#1e293b',
    iconSymbol: tile.category === 'DEX' ? '⚡' : tile.category === 'CEX' ? '🏛️' : '💼',
    badgeText: tile.category || 'MARKET'
  };
}
