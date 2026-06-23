export type TradingStrategyId =
  | 'gs_quant_arch'
  | 'rentech_backtest'
  | 'two_sigma_risk'
  | 'citadel_alpha'
  | 'jane_street_mm'
  | 'aqr_factor'
  | 'de_shaw_stat_arb'
  | 'bridgewater_macro'
  | 'bloomberg_data'
  | 'virtu_execution';

export interface TradingStrategySpec {
  id: TradingStrategyId;
  label: string;
  desk: string;
  thesis: string;
  signalModel: string;
  entryRule: string;
  exitRule: string;
  sizingModel: string;
  riskModel: string;
  allowedTools: string[];
  maxTradePct: number;
}

export const ALL_TRADING_STRATEGY_IDS: TradingStrategyId[] = [
  'gs_quant_arch',
  'rentech_backtest',
  'two_sigma_risk',
  'citadel_alpha',
  'jane_street_mm',
  'aqr_factor',
  'de_shaw_stat_arb',
  'bridgewater_macro',
  'bloomberg_data',
  'virtu_execution',
];

export const DEFAULT_STRATEGY_ID: TradingStrategyId = 'two_sigma_risk';

export const STRATEGY_CATALOG: Record<TradingStrategyId, TradingStrategySpec> = {
  gs_quant_arch: {
    id: 'gs_quant_arch',
    label: 'Goldman Quantitative Architect',
    desk: 'Systematic Equity/ETF',
    thesis: 'Exploit short-horizon momentum continuation under controlled volatility.',
    signalModel: 'S = 0.5*zMom20 + 0.3*zRSI + 0.2*zVolumeShock',
    entryRule: 'Enter long when S > 1.1 and 20d vol < 70th percentile.',
    exitRule: 'Exit at +2.2 sigma reward, -1.0 sigma stop, or 5-bar timeout.',
    sizingModel: 'Volatility targeting with risk budget scaling.',
    riskModel: 'Sector cap + correlation cap + drawdown throttle.',
    allowedTools: ['execute_trade', 'stake_tokens', 'post_update', 'search_polymarket_markets'],
    maxTradePct: 0.28,
  },
  rentech_backtest: {
    id: 'rentech_backtest',
    label: 'Renaissance Backtesting Engine',
    desk: 'Statistical Validation',
    thesis: 'Trade only when features show stable out-of-sample predictive edge.',
    signalModel: 'S = ensemble(rankIC, hitRate, tStat) with walk-forward gating',
    entryRule: 'Enter when recent rolling IC > 0.03 and turnover-adjusted alpha > cost.',
    exitRule: 'Exit on IC collapse, stop at -0.8 sigma, target +1.8 sigma.',
    sizingModel: 'Confidence-weighted fractional Kelly capped by turnover.',
    riskModel: 'Strict OOS drift monitor and trade suspension gates.',
    allowedTools: ['execute_trade', 'post_update', 'search_polymarket_markets'],
    maxTradePct: 0.22,
  },
  two_sigma_risk: {
    id: 'two_sigma_risk',
    label: 'Two Sigma Risk Framework',
    desk: 'Portfolio Risk',
    thesis: 'Harvest moderate alpha while minimizing left-tail outcomes.',
    signalModel: 'S = alphaSignal * (1 - stressPenalty) * liquidityScore',
    entryRule: 'Enter only if projected VaR99 remains within daily risk budget.',
    exitRule: 'Hard stop at risk breach, trailing stop at 1.2 ATR, time stop at 8 bars.',
    sizingModel: 'Fractional Kelly (0.25x) clipped by drawdown regime.',
    riskModel: 'VaR/CVaR + max DD circuit breaker + leverage caps.',
    allowedTools: ['execute_trade', 'stake_tokens', 'post_update'],
    maxTradePct: 0.2,
  },
  citadel_alpha: {
    id: 'citadel_alpha',
    label: 'Citadel Alpha Research',
    desk: 'Multi-Signal Discovery',
    thesis: 'Blend weak orthogonal micro-signals into robust composite alpha.',
    signalModel: 'S = sum(w_i * z(feature_i)), w from rolling IC optimization',
    entryRule: 'Enter when composite z-score > 1.0 and regime filter aligns.',
    exitRule: 'Exit on regime mismatch or signal half-life decay > threshold.',
    sizingModel: 'Conviction bucket sizing with turnover penalty.',
    riskModel: 'Cross-signal correlation and decay monitoring.',
    allowedTools: ['execute_trade', 'pay_x402_service', 'search_polymarket_markets', 'post_update'],
    maxTradePct: 0.3,
  },
  jane_street_mm: {
    id: 'jane_street_mm',
    label: 'Jane Street Market Making',
    desk: 'Spread Capture',
    thesis: 'Capture micro-spread while controlling inventory drift.',
    signalModel: 'Quote skew = baseSpread + inventoryPenalty + volAdjustment',
    entryRule: 'Provide two-sided liquidity in liquid symbols under spread > cost floor.',
    exitRule: 'Inventory flattening and adverse-selection trigger exits.',
    sizingModel: 'Inventory band sizing around neutral target.',
    riskModel: 'Inventory hard bands + kill-switch for fast adverse flow.',
    allowedTools: ['execute_trade', 'bankr_limit_order', 'bankr_check_price', 'post_update'],
    maxTradePct: 0.18,
  },
  aqr_factor: {
    id: 'aqr_factor',
    label: 'AQR Factor Builder',
    desk: 'Systematic Factors',
    thesis: 'Capture value, momentum, quality, size, and low-vol premia.',
    signalModel: 'S = 0.25*Value + 0.25*Momentum + 0.2*Quality + 0.15*Size + 0.15*LowVol',
    entryRule: 'Enter top quantile composite names, avoid crowded exposures.',
    exitRule: 'Rebalance at schedule or when score rank falls below cutoff.',
    sizingModel: 'Risk parity across factor sleeves.',
    riskModel: 'Factor neutrality checks and exposure caps.',
    allowedTools: ['execute_trade', 'stake_tokens', 'post_update'],
    maxTradePct: 0.24,
  },
  de_shaw_stat_arb: {
    id: 'de_shaw_stat_arb',
    label: 'D.E. Shaw Stat Arb',
    desk: 'Pairs and Relative Value',
    thesis: 'Exploit mean reversion in cointegrated spreads.',
    signalModel: 'z = (spread - rollingMean) / rollingStd',
    entryRule: 'Open pair when |z| > 2.0 with valid cointegration p < 0.05.',
    exitRule: 'Close when |z| < 0.5, stop when |z| > 3.5.',
    sizingModel: 'Hedge-ratio neutral sizing with spread volatility target.',
    riskModel: 'Regime-break detector and pair retirement rules.',
    allowedTools: ['execute_trade', 'bankr_swap', 'post_update'],
    maxTradePct: 0.27,
  },
  bridgewater_macro: {
    id: 'bridgewater_macro',
    label: 'Bridgewater Macro Regimes',
    desk: 'Cross-Asset Macro',
    thesis: 'Rotate exposures across growth/inflation regimes.',
    signalModel: 'Regime = argmax P(growth,inflation quadrant | macro features)',
    entryRule: 'Shift allocation only when regime confidence > 65%.',
    exitRule: 'Revert toward all-weather baseline when confidence decays.',
    sizingModel: 'Base all-weather weights + tactical overlay.',
    riskModel: 'Crisis correlation monitor and geopolitical shock haircut.',
    allowedTools: ['execute_trade', 'stake_tokens', 'search_polymarket_markets', 'post_update'],
    maxTradePct: 0.26,
  },
  bloomberg_data: {
    id: 'bloomberg_data',
    label: 'Bloomberg Data Pipeline',
    desk: 'Data Quality + Feature Ops',
    thesis: 'Trade only on high-integrity, validated data snapshots.',
    signalModel: 'S = model(rawFeatures) gated by dataQualityScore >= 0.98',
    entryRule: 'No entry if feed stale, missing, or corporate-action checks fail.',
    exitRule: 'Immediate flatten on data integrity breach.',
    sizingModel: 'Quality-scaled sizing with stale-data haircut.',
    riskModel: 'Validation fail-safe and stale feed circuit breaker.',
    allowedTools: ['execute_trade', 'pay_x402_service', 'post_update'],
    maxTradePct: 0.16,
  },
  virtu_execution: {
    id: 'virtu_execution',
    label: 'Virtu Execution Algorithms',
    desk: 'Execution and Routing',
    thesis: 'Minimize implementation shortfall with adaptive execution tactics.',
    signalModel: 'Urgency score drives TWAP/VWAP/IS schedule selection',
    entryRule: 'Execute only when expected slippage < forecast threshold.',
    exitRule: 'Abort or switch schedule on impact/latency anomaly.',
    sizingModel: 'Slice parent orders by liquidity curve and urgency.',
    riskModel: 'Slippage control bands and max impact constraints.',
    allowedTools: ['execute_trade', 'bankr_limit_order', 'bankr_swap', 'post_update'],
    maxTradePct: 0.32,
  },
};

export function isTradingStrategyId(value: unknown): value is TradingStrategyId {
  return typeof value === 'string' && ALL_TRADING_STRATEGY_IDS.includes(value as TradingStrategyId);
}

export function getTradingStrategyById(id: TradingStrategyId | string | undefined | null): TradingStrategySpec {
  if (id && isTradingStrategyId(id)) {
    return STRATEGY_CATALOG[id];
  }
  return STRATEGY_CATALOG[DEFAULT_STRATEGY_ID];
}

export function getStrategyOptions() {
  return ALL_TRADING_STRATEGY_IDS.map((id) => ({ id, label: STRATEGY_CATALOG[id].label }));
}
