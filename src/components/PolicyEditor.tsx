/**
 * PolicyEditor
 *
 * Modal component for inline editing of ARC agent policies.
 * Allows editing enabled status, limits, and allowlists.
 */

import { useState } from 'react';
import { ARC_AGENTS } from '../data/agents';
import { type ArcPolicyRecord } from '../services/apiService';

interface PolicyEditorProps {
  policy: ArcPolicyRecord;
  onSave: (updates: {
    enabled?: boolean;
    maxUsdcPerTx?: number;
    maxUsdcPerDay?: number;
    cooldownSeconds?: number;
    allowlistedToAddresses?: string[];
    allowlistedTokenAddresses?: string[];
  }) => Promise<void>;
  onCancel: () => void;
  isSaving?: boolean;
}

export function PolicyEditor({ policy, onSave, onCancel, isSaving }: PolicyEditorProps) {
  const arcAgent = ARC_AGENTS.find((a) => a.index === policy.agentIndex);

  // Local state for editing
  const [enabled, setEnabled] = useState(policy.enabled);
  const [maxUsdcPerTx, setMaxUsdcPerTx] = useState(String(policy.maxUsdcPerTx));
  const [maxUsdcPerDay, setMaxUsdcPerDay] = useState(String(policy.maxUsdcPerDay));
  const [cooldownSeconds, setCooldownSeconds] = useState(String(policy.cooldownSeconds));
  const [allowlistedToAddresses, setAllowlistedToAddresses] = useState(
    policy.allowlistedToAddresses.join('\n')
  );
  const [allowlistedTokenAddresses, setAllowlistedTokenAddresses] = useState(
    policy.allowlistedTokenAddresses.join('\n')
  );
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    try {
      setError(null);

      // Validation
      const txVal = Number(maxUsdcPerTx);
      const dayVal = Number(maxUsdcPerDay);
      const coolVal = Number(cooldownSeconds);

      if (!Number.isFinite(txVal) || txVal <= 0) {
        throw new Error('Max USDC per TX must be a positive number');
      }
      if (!Number.isFinite(dayVal) || dayVal <= 0) {
        throw new Error('Max USDC per Day must be a positive number');
      }
      if (!Number.isFinite(coolVal) || coolVal < 0) {
        throw new Error('Cooldown must be >= 0');
      }

      // Parse allowlists
      const toAddresses = allowlistedToAddresses
        .split('\n')
        .map((x) => x.trim())
        .filter((x) => x.length > 0);
      const tokenAddresses = allowlistedTokenAddresses
        .split('\n')
        .map((x) => x.trim())
        .filter((x) => x.length > 0);

      await onSave({
        enabled,
        maxUsdcPerTx: txVal,
        maxUsdcPerDay: dayVal,
        cooldownSeconds: coolVal,
        allowlistedToAddresses: toAddresses,
        allowlistedTokenAddresses: tokenAddresses,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/50 backdrop-blur z-50" style={{ pointerEvents: 'auto' }}>
      <div className="rounded-xl border border-white/10 bg-black/95 text-white w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 border-b border-white/10 bg-black/80 px-4 py-3 flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-widest text-cyan-300">
            Edit Policy: {arcAgent?.role || `Agent ${policy.agentIndex}`}
          </h2>
          <button
            onClick={onCancel}
            disabled={isSaving}
            className="text-white/50 hover:text-white disabled:opacity-40"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Error message */}
          {error && (
            <div className="rounded-lg border border-red-400/30 bg-red-400/10 px-3 py-2 text-xs text-red-300">
              {error}
            </div>
          )}

          {/* Enabled toggle */}
          <div>
            <label className="flex items-center gap-2 text-xs font-bold text-zinc-300 cursor-pointer">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                disabled={isSaving}
                className="w-4 h-4 rounded"
              />
              <span>Agent Enabled</span>
            </label>
          </div>

          {/* Max USDC per TX */}
          <div>
            <label className="block text-xs font-bold text-zinc-400 mb-1">Max USDC per Transaction</label>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={maxUsdcPerTx}
              onChange={(e) => setMaxUsdcPerTx(e.target.value)}
              disabled={isSaving || !enabled}
              className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-xs text-white placeholder-zinc-600 focus:border-cyan-500 focus:outline-none disabled:opacity-50"
            />
          </div>

          {/* Max USDC per Day */}
          <div>
            <label className="block text-xs font-bold text-zinc-400 mb-1">Max USDC per Day</label>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={maxUsdcPerDay}
              onChange={(e) => setMaxUsdcPerDay(e.target.value)}
              disabled={isSaving || !enabled}
              className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-xs text-white placeholder-zinc-600 focus:border-cyan-500 focus:outline-none disabled:opacity-50"
            />
          </div>

          {/* Cooldown Seconds */}
          <div>
            <label className="block text-xs font-bold text-zinc-400 mb-1">Cooldown (seconds)</label>
            <input
              type="number"
              min="0"
              step="1"
              value={cooldownSeconds}
              onChange={(e) => setCooldownSeconds(e.target.value)}
              disabled={isSaving || !enabled}
              className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-xs text-white placeholder-zinc-600 focus:border-cyan-500 focus:outline-none disabled:opacity-50"
            />
          </div>

          {/* Allowlisted To Addresses */}
          <div>
            <label className="block text-xs font-bold text-zinc-400 mb-1">
              Allowlisted Destination Addresses (one per line)
            </label>
            <textarea
              value={allowlistedToAddresses}
              onChange={(e) => setAllowlistedToAddresses(e.target.value)}
              disabled={isSaving || !enabled}
              placeholder="0x742d35Cc6634C0532925a3b844Bc9e7595f...
0x..."
              className="w-full h-24 rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-[10px] font-mono text-white placeholder-zinc-600 focus:border-cyan-500 focus:outline-none disabled:opacity-50 resize-none"
            />
            <p className="text-[9px] text-zinc-600 mt-1">
              {allowlistedToAddresses
                .split('\n')
                .filter((x) => x.trim().length > 0).length}{' '}
              addresses
            </p>
          </div>

          {/* Allowlisted Token Addresses */}
          <div>
            <label className="block text-xs font-bold text-zinc-400 mb-1">
              Allowlisted Token Addresses (one per line)
            </label>
            <textarea
              value={allowlistedTokenAddresses}
              onChange={(e) => setAllowlistedTokenAddresses(e.target.value)}
              disabled={isSaving || !enabled}
              placeholder="0xd9aAEc86B65D86f6A7B630E2c2Df4B0Bc9f...
(leave empty to allow all)"
              className="w-full h-24 rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-[10px] font-mono text-white placeholder-zinc-600 focus:border-cyan-500 focus:outline-none disabled:opacity-50 resize-none"
            />
            <p className="text-[9px] text-zinc-600 mt-1">
              {allowlistedTokenAddresses
                .split('\n')
                .filter((x) => x.trim().length > 0).length}{' '}
              tokens
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 border-t border-white/10 bg-black/80 px-4 py-3 flex items-center gap-2 justify-end">
          <button
            onClick={onCancel}
            disabled={isSaving}
            className="rounded-lg bg-white/10 px-3 py-2 text-xs font-bold hover:bg-white/20 disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="rounded-lg bg-cyan-500/20 px-3 py-2 text-xs font-bold text-cyan-300 hover:bg-cyan-500/30 disabled:opacity-40"
          >
            {isSaving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
