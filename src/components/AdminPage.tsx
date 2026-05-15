import React, { useEffect, useMemo, useState } from 'react';
import { useAccount } from 'wagmi';
import SignInButton from './SignInButton';
import NotificationStatusIndicator from './NotificationStatusIndicator';
import { getAdminOverview, AdminOverviewResponse } from '../services/adminService';
import {
  getConsentedUsers,
  sendBroadcastNotification,
  ConsentedUsersResponse,
  SendResponse,
} from '../services/baseNotificationsService';

type AdminTab = 'notifications' | 'users' | 'system';

function shortAddress(address: string): string {
  if (address.length < 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

const AdminPage: React.FC = () => {
  const { address, isConnected } = useAccount();
  const [tab, setTab] = useState<AdminTab>('notifications');
  const [overview, setOverview] = useState<AdminOverviewResponse | null>(null);
  const [audience, setAudience] = useState<ConsentedUsersResponse | null>(null);
  const [loadingOverview, setLoadingOverview] = useState(false);
  const [loadingAudience, setLoadingAudience] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sendResult, setSendResult] = useState<SendResponse | null>(null);

  const [title, setTitle] = useState('Monopolous Update');
  const [message, setMessage] = useState('The board just shifted. Check the live game state now.');
  const [targetPath, setTargetPath] = useState('/');
  const [subtitle, setSubtitle] = useState('New activity detected');
  const [ctaLabel, setCtaLabel] = useState('Open Monopolous');
  const [ctaUrl, setCtaUrl] = useState('https://monopolous.vercel.app');
  const [imageUrl, setImageUrl] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [section, setSection] = useState<'about' | 'world' | 'social' | 'posts' | 'admin'>('world');
  const [textColor, setTextColor] = useState('#22d3ee');
  const [fontFamily, setFontFamily] = useState('Space Grotesk');
  const [fontWeight, setFontWeight] = useState('700');

  function appendEmoji(emoji: string) {
    setMessage((prev) => `${prev} ${emoji}`.trim());
  }

  function buildSectionPath(): string {
    if (section === 'admin') return '/admin';
    return `/?section=${encodeURIComponent(section)}`;
  }

  const configuredAdmin = (import.meta.env.VITE_ADMIN_WALLET_ADDRESS as string | undefined)?.toLowerCase();
  const connectedAddress = address?.toLowerCase();
  const isConfigured = Boolean(configuredAdmin);
  const isCorrectWallet = Boolean(configuredAdmin && connectedAddress && configuredAdmin === connectedAddress);

  const authStatusText = useMemo(() => {
    if (!isConfigured) return 'Admin wallet not configured (set VITE_ADMIN_WALLET_ADDRESS)';
    if (!isConnected || !address) return 'Connect and sign in with admin wallet';
    if (!isCorrectWallet) return `Connected wallet ${shortAddress(address)} is not admin`;
    return 'Admin wallet verified';
  }, [isConfigured, isConnected, address, isCorrectWallet]);

  async function loadOverview() {
    setLoadingOverview(true);
    setError(null);
    try {
      const data = await getAdminOverview();
      if (!data) {
        setError('Admin auth required or wallet is not authorized.');
        setOverview(null);
        return;
      }
      setOverview(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load admin overview');
    } finally {
      setLoadingOverview(false);
    }
  }

  async function loadAudience() {
    setLoadingAudience(true);
    setError(null);
    try {
      const data = await getConsentedUsers();
      if (!data) {
        setError('Admin auth required to fetch consented users.');
        setAudience(null);
        return;
      }
      setAudience(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load consented users');
    } finally {
      setLoadingAudience(false);
    }
  }

  async function sendRichNotification() {
    setSending(true);
    setError(null);
    setSendResult(null);
    try {
      const response = await sendBroadcastNotification({
        title,
        message,
        targetPath: targetPath.trim() ? targetPath : buildSectionPath(),
        subtitle,
        ctaLabel,
        ctaUrl,
        imageUrl,
        mediaUrl,
        section,
        textColor,
        fontFamily,
        fontWeight,
      });

      if (!response) {
        setError('Admin auth required to send notifications.');
        return;
      }

      setSendResult(response);
      await loadAudience();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send notifications');
    } finally {
      setSending(false);
    }
  }

  useEffect(() => {
    if (!isCorrectWallet) return;
    void loadOverview();
    void loadAudience();
  }, [isCorrectWallet]);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-4 md:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-widest text-zinc-400">Monopolous</p>
            <h1 className="text-3xl font-black">Admin Console</h1>
            <p className="mt-1 text-sm text-zinc-300">Manage users, system health, and rich push notifications.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <NotificationStatusIndicator />
            <SignInButton />
            <a href="/" className="rounded-xl bg-white/10 px-3 py-2 text-xs font-bold uppercase tracking-widest hover:bg-white/20">
              Back to Game
            </a>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs uppercase tracking-wider text-zinc-400">Wallet Access</p>
          <p className={`mt-1 text-sm ${isCorrectWallet ? 'text-emerald-300' : 'text-amber-300'}`}>{authStatusText}</p>
          {configuredAdmin && (
            <p className="mt-1 text-xs text-zinc-500">Allowed admin wallet: {shortAddress(configuredAdmin)}</p>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <button onClick={() => setTab('notifications')} className={`rounded-xl px-4 py-2 text-xs font-black uppercase tracking-widest ${tab === 'notifications' ? 'bg-white text-zinc-900' : 'bg-white/10 hover:bg-white/20'}`}>
            Notifications
          </button>
          <button onClick={() => setTab('users')} className={`rounded-xl px-4 py-2 text-xs font-black uppercase tracking-widest ${tab === 'users' ? 'bg-white text-zinc-900' : 'bg-white/10 hover:bg-white/20'}`}>
            Users
          </button>
          <button onClick={() => setTab('system')} className={`rounded-xl px-4 py-2 text-xs font-black uppercase tracking-widest ${tab === 'system' ? 'bg-white text-zinc-900' : 'bg-white/10 hover:bg-white/20'}`}>
            System
          </button>
        </div>

        {error && <div className="rounded-xl border border-red-400/40 bg-red-400/10 px-4 py-3 text-sm text-red-200">{error}</div>}

        {tab === 'notifications' && (
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
              <h2 className="text-lg font-bold">Send Rich Notification</h2>
              <p className="text-xs text-zinc-400">Push providers usually render plain text, so rich style and media settings are embedded into deep links and app-side presentation.</p>
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className="w-full rounded-lg border border-white/20 bg-black/40 px-3 py-2 text-sm" />
              <textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Message" rows={3} className="w-full rounded-lg border border-white/20 bg-black/40 px-3 py-2 text-sm" />
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => appendEmoji('🔥')} className="rounded-md bg-white/10 px-2 py-1 text-sm hover:bg-white/20">🔥</button>
                <button type="button" onClick={() => appendEmoji('🚀')} className="rounded-md bg-white/10 px-2 py-1 text-sm hover:bg-white/20">🚀</button>
                <button type="button" onClick={() => appendEmoji('🎯')} className="rounded-md bg-white/10 px-2 py-1 text-sm hover:bg-white/20">🎯</button>
                <button type="button" onClick={() => appendEmoji('💎')} className="rounded-md bg-white/10 px-2 py-1 text-sm hover:bg-white/20">💎</button>
                <button type="button" onClick={() => appendEmoji('⚡')} className="rounded-md bg-white/10 px-2 py-1 text-sm hover:bg-white/20">⚡</button>
              </div>
              <input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} placeholder="Subtitle (optional)" className="w-full rounded-lg border border-white/20 bg-black/40 px-3 py-2 text-sm" />
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                <input value={ctaLabel} onChange={(e) => setCtaLabel(e.target.value)} placeholder="CTA label" className="rounded-lg border border-white/20 bg-black/40 px-3 py-2 text-sm" />
                <input value={ctaUrl} onChange={(e) => setCtaUrl(e.target.value)} placeholder="CTA URL" className="rounded-lg border border-white/20 bg-black/40 px-3 py-2 text-sm" />
              </div>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                <input value={targetPath} onChange={(e) => setTargetPath(e.target.value)} placeholder="Target path" className="rounded-lg border border-white/20 bg-black/40 px-3 py-2 text-sm" />
                <input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="Image URL (optional)" className="rounded-lg border border-white/20 bg-black/40 px-3 py-2 text-sm" />
              </div>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                <select value={section} onChange={(e) => setSection(e.target.value as 'about' | 'world' | 'social' | 'posts' | 'admin')} className="rounded-lg border border-white/20 bg-black/40 px-3 py-2 text-sm">
                  <option value="world">Open section: World</option>
                  <option value="social">Open section: Social</option>
                  <option value="posts">Open section: Posts</option>
                  <option value="about">Open section: About</option>
                  <option value="admin">Open section: Admin</option>
                </select>
                <input value={mediaUrl} onChange={(e) => setMediaUrl(e.target.value)} placeholder="GIF or tiny image URL" className="rounded-lg border border-white/20 bg-black/40 px-3 py-2 text-sm" />
              </div>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                <select value={fontFamily} onChange={(e) => setFontFamily(e.target.value)} className="rounded-lg border border-white/20 bg-black/40 px-3 py-2 text-sm">
                  <option value="Space Grotesk">Font: Space Grotesk</option>
                  <option value="Sora">Font: Sora</option>
                  <option value="Manrope">Font: Manrope</option>
                  <option value="sans-serif">Font: System Sans</option>
                </select>
                <select value={fontWeight} onChange={(e) => setFontWeight(e.target.value)} className="rounded-lg border border-white/20 bg-black/40 px-3 py-2 text-sm">
                  <option value="500">Weight: 500</option>
                  <option value="600">Weight: 600</option>
                  <option value="700">Weight: 700</option>
                  <option value="800">Weight: 800</option>
                </select>
                <input value={textColor} onChange={(e) => setTextColor(e.target.value)} placeholder="Text color hex" className="rounded-lg border border-white/20 bg-black/40 px-3 py-2 text-sm" />
              </div>
              <div className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs" style={{ color: textColor, fontFamily, fontWeight: Number(fontWeight) as 500 | 600 | 700 | 800 }}>
                Preview: {title} - {message}
              </div>
              <button disabled={!isCorrectWallet || sending} onClick={() => void sendRichNotification()} className="rounded-xl bg-emerald-400 px-4 py-2 text-sm font-black uppercase tracking-widest text-zinc-900 disabled:opacity-50">
                {sending ? 'Sending...' : 'Send Notification'}
              </button>
              {sendResult && (
                <div className="rounded-xl border border-emerald-400/40 bg-emerald-400/10 p-3 text-xs text-emerald-200">
                  Sent: {sendResult.sentCount ?? 0} | Failed: {sendResult.failedCount ?? 0} | Audience: {sendResult.audienceCount ?? 0}
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-lg font-bold">Consented Audience</h2>
                <button disabled={!isCorrectWallet || loadingAudience} onClick={() => void loadAudience()} className="rounded-lg bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-widest hover:bg-white/20 disabled:opacity-50">
                  {loadingAudience ? 'Refreshing...' : 'Refresh'}
                </button>
              </div>
              <p className="mb-3 text-xs text-zinc-400">These are wallet addresses fetched from Base Notifications and used as recipients.</p>
              <div className="max-h-[420px] overflow-auto rounded-lg border border-white/10">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-zinc-900">
                    <tr>
                      <th className="px-3 py-2">Wallet</th>
                      <th className="px-3 py-2">Consented</th>
                    </tr>
                  </thead>
                  <tbody>
                    {audience?.users?.map((user) => (
                      <tr key={user.address} className="border-t border-white/10">
                        <td className="px-3 py-2 font-mono">{user.address}</td>
                        <td className="px-3 py-2">{user.notificationsEnabled ? 'Yes' : 'No'}</td>
                      </tr>
                    ))}
                    {!audience?.users?.length && (
                      <tr>
                        <td colSpan={2} className="px-3 py-4 text-zinc-400">No consented users loaded yet.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-xs text-zinc-500">Total consented users: {audience?.total ?? 0}</p>
            </div>
          </div>
        )}

        {tab === 'users' && (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-bold">Latest Active Users</h2>
              <button disabled={!isCorrectWallet || loadingOverview} onClick={() => void loadOverview()} className="rounded-lg bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-widest hover:bg-white/20 disabled:opacity-50">
                {loadingOverview ? 'Refreshing...' : 'Refresh'}
              </button>
            </div>
            <div className="space-y-2">
              {overview?.latestUsers?.map((user) => (
                <div key={user.address} className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
                  <p className="font-mono text-xs">{user.address}</p>
                  <p className="text-xs text-zinc-300">{user.displayName ?? 'Unnamed'} • Games: {user.totalGamesPlayed}</p>
                </div>
              ))}
              {!overview?.latestUsers?.length && <p className="text-sm text-zinc-400">No users found.</p>}
            </div>
          </div>
        )}

        {tab === 'system' && (
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-widest text-zinc-400">Users</p>
              <p className="mt-2 text-3xl font-black">{overview?.counts.users ?? 0}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-widest text-zinc-400">Active Sessions</p>
              <p className="mt-2 text-3xl font-black">{overview?.counts.activeSessions ?? 0}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-widest text-zinc-400">Trades</p>
              <p className="mt-2 text-3xl font-black">{overview?.counts.trades ?? 0}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-widest text-zinc-400">Token Launches</p>
              <p className="mt-2 text-3xl font-black">{overview?.counts.tokenLaunches ?? 0}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-widest text-zinc-400">Social Posts</p>
              <p className="mt-2 text-3xl font-black">{overview?.counts.socialPosts ?? 0}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-widest text-zinc-400">Generated At</p>
              <p className="mt-2 text-sm font-semibold">{overview?.generatedAt ? new Date(overview.generatedAt).toLocaleString() : 'Not loaded'}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminPage;
