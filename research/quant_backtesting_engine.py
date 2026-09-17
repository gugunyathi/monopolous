"""
Quant Backtesting and Risk Validation Framework

Runnable example:
    python research/quant_backtesting_engine.py

Dependencies:
    pip install numpy pandas matplotlib scipy
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List, Tuple
import math

import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from scipy import stats


@dataclass
class CostModel:
    commission_bps: float = 1.0
    spread_bps: float = 2.0
    slippage_bps: float = 3.0
    impact_k: float = 12.0
    impact_alpha: float = 0.5

    def per_trade_cost(self, notional: float, adv: float) -> float:
        bps = self.commission_bps + self.spread_bps + self.slippage_bps
        impact_bps = self.impact_k * ((max(notional, 1e-9) / max(adv, 1e-9)) ** self.impact_alpha)
        total_bps = bps + impact_bps
        return notional * total_bps / 10_000.0


@dataclass
class BacktestConfig:
    initial_capital: float = 1_000_000.0
    max_gross_leverage: float = 1.0
    max_position_weight: float = 0.2


class EventBacktester:
    def __init__(self, cfg: BacktestConfig, costs: CostModel):
        self.cfg = cfg
        self.costs = costs

    def run(self, df: pd.DataFrame, signal_col: str = "signal") -> pd.DataFrame:
        """
        df expected columns:
            close, ret_fwd_1, adv_usd, signal
        """
        data = df.copy()
        data["signal_lag"] = data[signal_col].shift(1).fillna(0.0)

        # Position sizing from conviction, clipped for leverage/risk.
        raw_w = np.tanh(data["signal_lag"])
        clipped_w = raw_w.clip(-self.cfg.max_position_weight, self.cfg.max_position_weight)
        data["weight"] = clipped_w

        turnover = (data["weight"] - data["weight"].shift(1).fillna(0.0)).abs()
        data["turnover"] = turnover

        # PnL before costs using next-bar return.
        data["gross_pnl"] = data["weight"] * data["ret_fwd_1"] * self.cfg.initial_capital

        # Cost from turnover notional.
        notional = turnover * self.cfg.initial_capital
        data["cost"] = [
            self.costs.per_trade_cost(n, adv)
            for n, adv in zip(notional.values, data["adv_usd"].values)
        ]

        data["net_pnl"] = data["gross_pnl"] - data["cost"]
        data["equity"] = self.cfg.initial_capital + data["net_pnl"].cumsum()
        data["ret"] = data["net_pnl"] / self.cfg.initial_capital

        running_max = data["equity"].cummax()
        data["drawdown"] = (data["equity"] - running_max) / running_max

        return data


def make_sample_data(n: int = 2500, seed: int = 7) -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    idx = pd.date_range("2016-01-01", periods=n, freq="B")

    regime = np.where(np.sin(np.arange(n) / 180.0) > 0, 1.0, -1.0)
    eps = rng.normal(0.0, 0.012, size=n)
    base_ret = 0.0002 * regime + eps
    price = 100.0 * np.exp(np.cumsum(base_ret))

    df = pd.DataFrame(index=idx)
    df["close"] = price
    df["ret_1"] = df["close"].pct_change().fillna(0.0)
    df["ret_fwd_1"] = df["ret_1"].shift(-1).fillna(0.0)

    mom20 = df["close"].pct_change(20).fillna(0.0)
    vol20 = df["ret_1"].rolling(20).std().fillna(df["ret_1"].std())
    z_mom = (mom20 - mom20.rolling(252).mean().fillna(0.0)) / (
        mom20.rolling(252).std().replace(0, np.nan).fillna(mom20.std() + 1e-9)
    )
    z_vol = (vol20 - vol20.rolling(252).mean().fillna(vol20.mean())) / (
        vol20.rolling(252).std().replace(0, np.nan).fillna(vol20.std() + 1e-9)
    )

    df["signal"] = 0.8 * z_mom - 0.2 * z_vol
    df["adv_usd"] = 5_000_000 + 2_000_000 * (1 + np.sin(np.arange(n) / 35.0))

    return df


def walk_forward_backtest(
    df: pd.DataFrame,
    train_bars: int = 500,
    test_bars: int = 125,
) -> pd.DataFrame:
    frames: List[pd.DataFrame] = []
    bt = EventBacktester(BacktestConfig(), CostModel())

    start = train_bars
    while start + test_bars <= len(df):
        train = df.iloc[start - train_bars : start]
        test = df.iloc[start : start + test_bars].copy()

        # Lightweight parameter selection on train.
        best_w = 0.8
        best_sr = -np.inf
        for w in np.linspace(0.2, 1.2, 6):
            tmp = train.copy()
            tmp["signal"] = w * tmp["signal"]
            res = bt.run(tmp)
            sr = annualized_sharpe(res["ret"])
            if sr > best_sr:
                best_sr = sr
                best_w = w

        test["signal"] = best_w * test["signal"]
        out = bt.run(test)
        out["wf_weight"] = best_w
        frames.append(out)

        start += test_bars

    return pd.concat(frames)


def annualized_sharpe(returns: pd.Series, periods: int = 252) -> float:
    r = returns.dropna()
    if r.std(ddof=1) == 0:
        return 0.0
    return (r.mean() / r.std(ddof=1)) * math.sqrt(periods)


def var_historical(returns: pd.Series, alpha: float = 0.95) -> float:
    return -np.quantile(returns.dropna(), 1 - alpha)


def var_parametric(returns: pd.Series, alpha: float = 0.95) -> float:
    mu = returns.mean()
    sigma = returns.std(ddof=1)
    z = stats.norm.ppf(alpha)
    return -(mu - z * sigma)


def monte_carlo_trade_bootstrap(trade_pnl: np.ndarray, n_paths: int = 3000, seed: int = 17) -> Dict[str, float]:
    rng = np.random.default_rng(seed)
    if trade_pnl.size == 0:
        return {"p5": 0.0, "p50": 0.0, "p95": 0.0}

    terminal = []
    for _ in range(n_paths):
        sample = rng.choice(trade_pnl, size=trade_pnl.size, replace=True)
        terminal.append(sample.sum())

    return {
        "p5": float(np.percentile(terminal, 5)),
        "p50": float(np.percentile(terminal, 50)),
        "p95": float(np.percentile(terminal, 95)),
    }


def information_coefficient(signal: pd.Series, future_ret: pd.Series) -> float:
    x = signal.values
    y = future_ret.values
    mask = np.isfinite(x) & np.isfinite(y)
    if mask.sum() < 10:
        return 0.0
    rho, _ = stats.spearmanr(x[mask], y[mask])
    return float(rho if np.isfinite(rho) else 0.0)


def reality_check_pvalue(returns: pd.Series, n_boot: int = 2000, seed: int = 101) -> float:
    rng = np.random.default_rng(seed)
    r = returns.dropna().values
    obs = r.mean()
    if r.size < 20:
        return 1.0
    means = np.array([rng.choice(r, size=r.size, replace=True).mean() for _ in range(n_boot)])
    return float((means >= obs).mean())


def summarize(result: pd.DataFrame) -> Dict[str, float]:
    total_ret = result["equity"].iloc[-1] / result["equity"].iloc[0] - 1
    dd = result["drawdown"].min()
    sr = annualized_sharpe(result["ret"])
    var95_h = var_historical(result["ret"], 0.95)
    var99_h = var_historical(result["ret"], 0.99)
    var95_p = var_parametric(result["ret"], 0.95)
    var99_p = var_parametric(result["ret"], 0.99)
    ic = information_coefficient(result["signal_lag"], result["ret_fwd_1"])
    pval = reality_check_pvalue(result["ret"])

    return {
        "total_return": float(total_ret),
        "max_drawdown": float(dd),
        "sharpe": float(sr),
        "var95_hist": float(var95_h),
        "var99_hist": float(var99_h),
        "var95_param": float(var95_p),
        "var99_param": float(var99_p),
        "information_coefficient": float(ic),
        "reality_check_pvalue": float(pval),
    }


def plot_results(result: pd.DataFrame) -> None:
    fig, axes = plt.subplots(3, 1, figsize=(12, 10), sharex=True)

    axes[0].plot(result.index, result["equity"], label="Equity", color="tab:blue")
    axes[0].set_title("Equity Curve")
    axes[0].grid(alpha=0.2)

    axes[1].plot(result.index, result["drawdown"], label="Drawdown", color="tab:red")
    axes[1].set_title("Drawdown")
    axes[1].grid(alpha=0.2)

    axes[2].plot(result.index, result["weight"], label="Position Weight", color="tab:green")
    axes[2].set_title("Position Weight")
    axes[2].grid(alpha=0.2)

    plt.tight_layout()
    plt.show()


def main() -> None:
    df = make_sample_data()

    wf = walk_forward_backtest(df)
    stats_summary = summarize(wf)

    print("=== Walk-Forward Metrics ===")
    for k, v in stats_summary.items():
        print(f"{k:>24}: {v: .6f}")

    trade_pnl = wf["net_pnl"].values
    mc = monte_carlo_trade_bootstrap(trade_pnl)
    print("\n=== Monte Carlo Terminal PnL (bootstrap) ===")
    for k, v in mc.items():
        print(f"{k:>24}: {v:,.2f}")

    plot_results(wf)


if __name__ == "__main__":
    main()
