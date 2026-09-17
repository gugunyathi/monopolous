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

export const ALL_STRATEGY_IDS: TradingStrategyId[] = [
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

const STRATEGY_LABELS: Record<TradingStrategyId, string> = {
  gs_quant_arch: 'Goldman Quantitative Architect',
  rentech_backtest: 'Renaissance Backtesting Engine',
  two_sigma_risk: 'Two Sigma Risk Framework',
  citadel_alpha: 'Citadel Alpha Research',
  jane_street_mm: 'Jane Street Market Making',
  aqr_factor: 'AQR Factor Builder',
  de_shaw_stat_arb: 'D.E. Shaw Stat Arb',
  bridgewater_macro: 'Bridgewater Macro Regimes',
  bloomberg_data: 'Bloomberg Data Pipeline',
  virtu_execution: 'Virtu Execution Algorithms',
};

const EXECUTION_MULTIPLIER: Record<TradingStrategyId, number> = {
  gs_quant_arch: 0.9,
  rentech_backtest: 0.65,
  two_sigma_risk: 0.6,
  citadel_alpha: 0.95,
  jane_street_mm: 0.7,
  aqr_factor: 0.72,
  de_shaw_stat_arb: 0.85,
  bridgewater_macro: 0.8,
  bloomberg_data: 0.55,
  virtu_execution: 1.0,
};

export function isStrategyId(value: unknown): value is TradingStrategyId {
  return typeof value === 'string' && ALL_STRATEGY_IDS.includes(value as TradingStrategyId);
}

export function getExecutionMultiplier(strategyId?: string | null): number {
  if (!strategyId || !isStrategyId(strategyId)) {
    return EXECUTION_MULTIPLIER[DEFAULT_STRATEGY_ID];
  }
  return EXECUTION_MULTIPLIER[strategyId];
}

export function getStrategySummaries() {
  return ALL_STRATEGY_IDS.map((id) => ({
    id,
    label: STRATEGY_LABELS[id],
    executionMultiplier: EXECUTION_MULTIPLIER[id],
  }));
}
