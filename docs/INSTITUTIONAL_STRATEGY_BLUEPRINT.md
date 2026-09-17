# Institutional Bot Strategy Blueprint

This document defines 10 institutional-style strategy families for Monopolous bots. Each strategy includes:
- strategy thesis
- universe
- signal, entry, exit, sizing, risk controls
- backtesting framework and benchmark guidance
- edge decay monitoring
- pseudocode and implementation notes

The runtime strategy selector is integrated via:
- frontend catalog: src/constants/tradingStrategies.ts
- bot assignment: src/data/agents.ts
- ARC policy persistence: server/src/models/ArcPolicy.ts
- ARC execution controls: server/src/services/arcExecutor.ts

## 1) Goldman Sachs Quantitative Strategies Architect

### Thesis
Exploit short-horizon momentum persistence conditioned on volatility compression and liquidity expansion.

### Universe
Large-cap crypto proxies and liquid majors used by bots (BTC, ETH, SOL, LINK, USDC pairs).

### Signal
\[
S_t = 0.5 z(RET_{20}) + 0.3 z(RSI_{14}) + 0.2 z(VOLSHOCK_{5})
\]

### Entry
- Long if \(S_t > 1.1\) and realized vol < 70th percentile.
- Short/defensive sell if \(S_t < -1.1\).

### Exit
- Take profit: +2.2 sigma.
- Stop: -1.0 sigma.
- Time stop: 5 bars.
- Signal reversal: if sign(S) flips.

### Position Sizing
\[
w_t = \min(w_{max}, \lambda \cdot \frac{\sigma^*}{\hat{\sigma}_t} \cdot c_t)
\]
where \(c_t\) is conviction in [0,1].

### Risk Parameters
| Parameter | Value |
|---|---:|
| Max drawdown hard stop | 12% |
| Single position cap | 8% NAV |
| Sector/token bucket cap | 25% |
| Pairwise correlation cap | 0.75 |

### Backtest / Benchmark / Decay
- Walk-forward over rolling windows.
- Benchmark: equal-weight major-token basket.
- Decay trigger: 60-day rolling Sharpe < 0.5 for 3 windows.

### Pseudocode
```text
compute S_t
if S_t > 1.1 and risk_ok: buy(size_from_vol_target)
if S_t < -1.1 and risk_ok: sell(size_from_vol_target)
exit on TP/SL/time/reversal
```

## 2) Renaissance Technologies Backtesting Engine

### Data Requirements
- OHLCV at minute and daily granularity.
- Corporate-action-like adjustments where applicable for synthetic assets.
- Minimum 5 years equivalent bars for stable validation.

### Architecture
- Event-driven execution simulator for order realism.
- Vectorized factor precomputation for speed.

### Cost Model
\[
C = commission + spread\_half + slippage + impact
\]
\[
impact = k \left(\frac{q}{ADV}\right)^\alpha
\]

### Bias Controls
- Strict timestamp gating to prevent lookahead.
- Delisted/survivorship simulation by dynamic universe membership.

### Walk-Forward
- Train 24 months, test 3 months, slide forward by 3 months.

### OOS Protocol
- 60/20/20 chronological split (train/validate/test), no reshuffle.

### Monte Carlo
- Trade sequence bootstrap (10,000 paths) for drawdown and ruin probability.

### Significance Tests
- Newey-West adjusted t-stat for alpha.
- White Reality Check style bootstrap across strategy variants.

### Runnable Code
See research/quant_backtesting_engine.py.

## 3) Two Sigma Risk Management System

### Position Sizing (Fractional Kelly)
\[
f^* = \gamma \cdot \frac{bp - q}{b}, \; \gamma \in (0,1)
\]
with \(\gamma=0.25\) default.

### Stop Framework
- Fixed stop: 1.0-1.5 ATR.
- Trailing stop: max(high-water - 1.2 ATR, fixed stop).
- Vol-adjusted stop widens in high vol regime.
- Time stop: exit if no expected drift after N bars.

### Drawdown Controls
- DD > 8%: halve gross exposure.
- DD > 12%: halt new positions.
- DD > 15%: kill switch and human review.

### Correlation Monitoring
- Rolling 30-bar correlation matrix.
- If average off-diagonal > 0.65, reduce gross by 25%.

### VaR
Parametric:
\[
VaR_{\alpha} = z_{\alpha}\sigma_p - \mu_p
\]
Historical:
quantile of realized PnL distribution.

### Stress Tests
- 2008 style correlation spike + vol expansion.
- COVID gap and liquidity withdrawal.
- Flash crash spread widening.

### Daily Dashboard Checklist
- Current VaR95 / VaR99
- Realized DD and peak-to-trough
- Exposure by strategy, token, factor
- Correlation regime flag
- Liquidity exit time estimate
- Slippage drift and execution quality

## 4) Citadel Alpha Signals Research Lab

### 20 Signal Categories
1. Time-series momentum
2. Cross-sectional momentum
3. Mean reversion
4. Volatility carry
5. Volatility breakout
6. Volume imbalance
7. Order-flow toxicity proxy
8. Funding/basis dislocation
9. Relative strength
10. Liquidity shock
11. News sentiment
12. Social sentiment
13. On-chain flow
14. Stablecoin mint/burn proxy
15. Regime trend filter
16. Quality of move
17. Correlation breakdown
18. Macro surprise
19. Event-driven drift
20. Execution anomaly

### Signal Strength Tests
- Information Coefficient (IC)
- Hit rate
- Cost-adjusted IR

### Decay
Compute half-life by fitting IC decay curve over lags.

### Combination
\[
S_{combo} = \sum_i w_i z_i, \; w_i \propto \frac{IC_i}{\sigma_i} \text{ with correlation shrinkage}
\]

## 5) Jane Street Market Making Engine

### Spread Model
\[
spread_t = base + a\sigma_t + b\,inventory\_penalty + c\,toxicity
\]

### Inventory Management
- Maintain inventory in neutral band.
- Quote skew toward flattening inventory.

### Adverse Selection
- If post-fill price move exceeds threshold repeatedly, widen spread and reduce size.

### Risk Limits
| Parameter | Limit |
|---|---:|
| Max inventory | 1.5% NAV equivalent |
| Max daily loss | 2.0% NAV |
| Max quote age | 2-5 seconds equivalent loop |

## 6) AQR Factor Model Builder

### Factors
- Value, Momentum, Quality, Size, Low Volatility.

### Definitions (example)
\[
Value = z(\log(B/M)),\; Momentum = z(RET_{12-1}),\; LowVol = -z(\sigma_{60})
\]

### Composite
\[
Score = \sum_j w_j F_j
\]

### Portfolio
- Long top quantile, short bottom quantile (or long-only tilt in constrained mode).

### Rebalance
- Weekly or monthly based on turnover budget.

### Attribution
- Brinson-like decomposition into factor sleeves + idiosyncratic residual.

## 7) D.E. Shaw Statistical Arbitrage

### Pair Selection
- Correlation prefilter, then cointegration tests.

### Tests
- Engle-Granger and Johansen where multivariate basket needed.

### Spread and Z-score
\[
spread_t = P^A_t - \beta P^B_t
\]
\[
z_t = \frac{spread_t - \mu_t}{\sigma_t}
\]

### Rules
- Enter at |z| > 2.0.
- Add at |z| > 2.7 (max 2 adds).
- Exit at |z| < 0.5.
- Stop at |z| > 3.5.

## 8) Bridgewater Macro Trading Strategist

### 15 Macro Indicators
Growth nowcast, inflation nowcast, unemployment trend, yield curve slope, real rates, credit spreads, PMI, earnings revisions, money supply impulse, policy surprise, energy trend, USD trend, volatility index, liquidity conditions, geopolitical stress index.

### Regime Matrix
- Rising growth / rising inflation
- Rising growth / falling inflation
- Falling growth / rising inflation
- Falling growth / falling inflation

### Allocation
- Base all-weather risk-parity core.
- Tactical overlay when regime confidence > 65%.

## 9) Bloomberg Terminal Data Pipeline Builder

### Pipeline
- ingestion -> normalization -> validation -> corporate-action adjustment -> feature store -> strategy API.

### Validation Rules
- Missing bars, stale timestamps, outlier returns, crossed bid/ask proxy, duplicate keys.

### Storage
- Columnar historical store + low-latency cache for live reads.

### Scheduler
- Intraday minute refresh.
- Daily EOD recompute.
- Weekly feature rebuild.

## 10) Virtu Financial Execution Algorithm Designer

### TWAP
\[
q_i = \frac{Q}{N}
\]

### VWAP
\[
q_i = Q \cdot \frac{\hat{V}_i}{\sum_j \hat{V}_j}
\]

### Implementation Shortfall Objective
\[
\min_{schedule} \; E[impact] + \lambda E[risk\_of\_delay]
\]

### Slippage
\[
slippage = \frac{P_{exec} - P_{signal}}{P_{signal}}
\]

### TCA
Break cost into spread, delay, impact, and opportunity components.

---

## Bot Runtime Mapping

Strategy IDs used by bots:
- gs_quant_arch
- rentech_backtest
- two_sigma_risk
- citadel_alpha
- jane_street_mm
- aqr_factor
- de_shaw_stat_arb
- bridgewater_macro
- bloomberg_data
- virtu_execution

These are selectable in ARC Policy Editor and consumed by ADK orchestration and ARC autonomy.
