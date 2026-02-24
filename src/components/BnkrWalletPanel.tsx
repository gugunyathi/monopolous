/**
 * BnkrWalletPanel
 *
 * Displays the BNKR wallet connection status, master wallet address,
 * per-agent wallet overview, and treasury statistics.
 * Shown in the social/posts view modes.
 */

import { useState, useMemo } from 'react';
import { useStore } from '../store/useStore';
import { AGENTS, CORE_AGENT_COUNT } from '../data/agents';

export function BnkrWalletPanel() {
  const bnkrMasterAddress = useStore((s) => s.bnkrMasterAddress);
  const connectionStatus = useStore((s) => s.bnkrConnectionStatus);
  const bnkrWallets = useStore((s) => s.bnkrWallets);
  const [expanded, setExpanded] = useState(false);
  const [tab, setTab] = useState<'overview' | 'agents' | 'departments'>('overview');

  const stats = useMemo(() => {
    const connected = bnkrWallets.filter((w) => w.status === 'connected').length;
    const totalAlloc = bnkrWallets.reduce((s, w) => s + w.allocatedBalance, 0);
    const totalSpent = bnkrWallets.reduce((s, w) => s + w.totalSpent, 0);
    const totalEarned = bnkrWallets.reduce((s, w) => s + w.totalEarned, 0);
    return { connected, total: bnkrWallets.length, totalAlloc, totalSpent, totalEarned };
  }, [bnkrWallets]);

  const deptBreakdown = useMemo(() => {
    const map: Record<string, { count: number; balance: number; spent: number }> = {};
    bnkrWallets.forEach((w) => {
      const agent = AGENTS[w.agentIndex];
      if (!agent) return;
      const dept = agent.department;
      if (!map[dept]) map[dept] = { count: 0, balance: 0, spent: 0 };
      map[dept].count++;
      map[dept].balance += w.allocatedBalance;
      map[dept].spent += w.totalSpent;
    });
    return Object.entries(map).sort((a, b) => b[1].balance - a[1].balance);
  }, [bnkrWallets]);

  const statusColor =
    connectionStatus === 'connected'
      ? '#22c55e'
      : connectionStatus === 'connecting'
        ? '#eab308'
        : connectionStatus === 'error'
          ? '#ef4444'
          : '#6b7280';

  const statusLabel =
    connectionStatus === 'connected'
      ? 'Connected'
      : connectionStatus === 'connecting'
        ? 'Connecting...'
        : connectionStatus === 'error'
          ? 'Error'
          : 'Disconnected';

  if (!bnkrMasterAddress && connectionStatus === 'disconnected') {
    return (
      <div
        style={{
          position: 'absolute',
          top: 60,
          right: 16,
          background: 'rgba(15,15,20,0.85)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 8,
          padding: '8px 12px',
          color: '#9ca3af',
          fontSize: 11,
          fontFamily: 'monospace',
          zIndex: 1000,
          backdropFilter: 'blur(12px)',
        }}
      >
        🏦 BNKR Wallets: Awaiting provisioning...
      </div>
    );
  }

  return (
    <div
      style={{
        position: 'absolute',
        top: 60,
        right: 16,
        background: 'rgba(15,15,20,0.92)',
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: 10,
        padding: expanded ? 14 : '8px 12px',
        color: '#e5e7eb',
        fontSize: 11,
        fontFamily: 'monospace',
        zIndex: 1000,
        backdropFilter: 'blur(16px)',
        minWidth: expanded ? 320 : 'auto',
        maxWidth: 380,
        maxHeight: expanded ? 500 : 'auto',
        overflowY: expanded ? 'auto' : 'hidden',
        transition: 'all 0.2s ease',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
        }}
        onClick={() => setExpanded(!expanded)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 14 }}>🏦</span>
          <span style={{ fontWeight: 600, color: '#fff' }}>BNKR Wallets</span>
          <span
            style={{
              display: 'inline-block',
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: statusColor,
              boxShadow: `0 0 6px ${statusColor}`,
            }}
          />
          <span style={{ color: statusColor, fontSize: 10 }}>{statusLabel}</span>
        </div>
        <span style={{ color: '#6b7280', fontSize: 10 }}>{expanded ? '▲' : '▼'}</span>
      </div>

      {/* Compact summary */}
      {!expanded && bnkrMasterAddress && (
        <div style={{ marginTop: 4, color: '#9ca3af', fontSize: 10 }}>
          {stats.connected}/{stats.total} agents · ${stats.totalAlloc.toFixed(0)} allocated
        </div>
      )}

      {/* Expanded view */}
      {expanded && (
        <div style={{ marginTop: 10 }}>
          {/* Master wallet */}
          <div
            style={{
              background: 'rgba(34,197,94,0.08)',
              border: '1px solid rgba(34,197,94,0.2)',
              borderRadius: 6,
              padding: '8px 10px',
              marginBottom: 10,
            }}
          >
            <div style={{ fontSize: 10, color: '#9ca3af', marginBottom: 4 }}>Master Wallet</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ color: '#22c55e', fontSize: 12 }}>
                {bnkrMasterAddress.slice(0, 10)}…{bnkrMasterAddress.slice(-6)}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  navigator.clipboard.writeText(bnkrMasterAddress);
                }}
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 4,
                  color: '#9ca3af',
                  fontSize: 9,
                  padding: '2px 6px',
                  cursor: 'pointer',
                }}
              >
                Copy
              </button>
              <a
                href={`https://basescan.org/address/${bnkrMasterAddress}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                style={{ color: '#60a5fa', fontSize: 9, textDecoration: 'none' }}
              >
                Basescan ↗
              </a>
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
            {(['overview', 'agents', 'departments'] as const).map((t) => (
              <button
                key={t}
                onClick={(e) => {
                  e.stopPropagation();
                  setTab(t);
                }}
                style={{
                  background: tab === t ? 'rgba(96,165,250,0.15)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${tab === t ? 'rgba(96,165,250,0.3)' : 'rgba(255,255,255,0.08)'}`,
                  borderRadius: 4,
                  color: tab === t ? '#60a5fa' : '#9ca3af',
                  fontSize: 10,
                  padding: '4px 10px',
                  cursor: 'pointer',
                  flex: 1,
                }}
              >
                {t === 'overview' ? '📊 Overview' : t === 'agents' ? '👥 Agents' : '🏢 Depts'}
              </button>
            ))}
          </div>

          {/* Overview Tab */}
          {tab === 'overview' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              <StatBox label="Connected" value={`${stats.connected}/${stats.total}`} color="#22c55e" />
              <StatBox label="Allocated" value={`$${stats.totalAlloc.toFixed(0)}`} color="#60a5fa" />
              <StatBox label="Total Spent" value={`$${stats.totalSpent.toFixed(0)}`} color="#f59e0b" />
              <StatBox label="Total Earned" value={`$${stats.totalEarned.toFixed(0)}`} color="#22c55e" />
            </div>
          )}

          {/* Agents Tab */}
          {tab === 'agents' && (
            <div style={{ maxHeight: 280, overflowY: 'auto' }}>
              {bnkrWallets.slice(0, 20).map((w) => {
                const agent = AGENTS[w.agentIndex];
                if (!agent) return null;
                return (
                  <div
                    key={w.agentIndex}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '4px 6px',
                      borderBottom: '1px solid rgba(255,255,255,0.04)',
                      fontSize: 10,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span
                        style={{
                          color: agent.color,
                          fontWeight: 600,
                          minWidth: 20,
                        }}
                      >
                        #{w.agentIndex}
                      </span>
                      <span style={{ color: '#d1d5db' }}>
                        {agent.role.length > 18 ? agent.role.slice(0, 18) + '…' : agent.role}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ color: '#9ca3af' }}>
                        ${w.allocatedBalance.toFixed(0)}
                      </span>
                      <span
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: '50%',
                          background: w.status === 'connected' ? '#22c55e' : '#6b7280',
                        }}
                      />
                    </div>
                  </div>
                );
              })}
              {bnkrWallets.length > 20 && (
                <div
                  style={{
                    textAlign: 'center',
                    color: '#6b7280',
                    fontSize: 10,
                    padding: 8,
                  }}
                >
                  +{bnkrWallets.length - 20} more agents
                </div>
              )}
            </div>
          )}

          {/* Departments Tab */}
          {tab === 'departments' && (
            <div>
              {deptBreakdown.map(([dept, info]) => (
                <div
                  key={dept}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '6px 4px',
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                    fontSize: 10,
                  }}
                >
                  <div>
                    <span style={{ color: '#d1d5db', fontWeight: 600 }}>{dept}</span>
                    <span style={{ color: '#6b7280', marginLeft: 6 }}>
                      {info.count} agents
                    </span>
                  </div>
                  <div>
                    <span style={{ color: '#60a5fa' }}>${info.balance.toFixed(0)}</span>
                    {info.spent > 0 && (
                      <span style={{ color: '#9ca3af', marginLeft: 6 }}>
                        (−${info.spent.toFixed(0)})
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatBox({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 6,
        padding: '6px 8px',
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: 9, color: '#6b7280', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 700, color }}>{value}</div>
    </div>
  );
}
