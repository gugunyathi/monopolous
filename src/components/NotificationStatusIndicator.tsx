import React, { useEffect, useState } from 'react';
import { useAccount } from 'wagmi';
import { getUserNotificationStatus, NotificationStatus } from '../services/baseNotificationsService';

const NotificationStatusIndicator: React.FC = () => {
  const { address, isConnected } = useAccount();
  const [status, setStatus] = useState<NotificationStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function checkStatus() {
      if (!isConnected || !address) {
        setStatus(null);
        setError(null);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const result = await getUserNotificationStatus(address);
        if (!cancelled) setStatus(result);
      } catch (err) {
        if (!cancelled) {
          setStatus(null);
          setError(err instanceof Error ? err.message : 'Failed to load notification status');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void checkStatus();
    return () => {
      cancelled = true;
    };
  }, [address, isConnected]);

  if (!isConnected) {
    return (
      <div className="flex items-center gap-2 bg-white/90 backdrop-blur-md border border-black/10 rounded-xl px-3 py-2 shadow-lg">
        <div className="w-2 h-2 rounded-full bg-zinc-400" />
        <span className="text-[10px] font-black uppercase tracking-widest text-zinc-600">Notifications: connect</span>
      </div>
    );
  }

  let dotClass = 'bg-zinc-400';
  let label = 'Notifications: unknown';

  if (loading) {
    dotClass = 'bg-blue-500 animate-pulse';
    label = 'Notifications: checking';
  } else if (error) {
    dotClass = 'bg-red-500';
    label = 'Notifications: unavailable';
  } else if (status?.appPinned && status.notificationsEnabled) {
    dotClass = 'bg-emerald-500';
    label = 'Notifications: enabled';
  } else if (status?.appPinned) {
    dotClass = 'bg-amber-500';
    label = 'Notifications: opt-in needed';
  } else if (status && !status.appPinned) {
    dotClass = 'bg-zinc-500';
    label = 'Notifications: pin app';
  }

  return (
    <div className="flex items-center gap-2 bg-white/90 backdrop-blur-md border border-black/10 rounded-xl px-3 py-2 shadow-lg">
      <div className={`w-2 h-2 rounded-full ${dotClass}`} />
      <span className="text-[10px] font-black uppercase tracking-widest text-zinc-700">{label}</span>
    </div>
  );
};

export default NotificationStatusIndicator;
