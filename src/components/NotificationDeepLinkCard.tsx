import React, { useMemo } from 'react';

const NotificationDeepLinkCard: React.FC = () => {
  const payload = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    const title = params.get('ntitle');
    const message = params.get('nmsg');

    if (!title && !message) return null;

    return {
      title: title ?? 'Monopolous Notification',
      message: message ?? '',
      subtitle: params.get('nsub') ?? '',
      mediaUrl: params.get('nmedia') ?? '',
      ctaLabel: params.get('ncta') ?? '',
      ctaUrl: params.get('nctau') ?? '',
      fontFamily: params.get('nfont') ?? 'inherit',
      fontWeight: params.get('nweight') ?? '700',
      textColor: params.get('ncolor') ?? '#ffffff',
    };
  }, []);

  if (!payload) return null;

  return (
    <div className="fixed top-16 left-1/2 z-[125] w-[min(92vw,560px)] -translate-x-1/2 pointer-events-auto">
      <div
        className="rounded-2xl border border-white/20 bg-zinc-900/85 p-4 shadow-2xl backdrop-blur-md"
        style={{
          color: payload.textColor,
          fontFamily: payload.fontFamily,
          fontWeight: Number(payload.fontWeight) || 700,
        }}
      >
        <p className="text-[10px] uppercase tracking-widest text-zinc-300">Rich Notification</p>
        <h3 className="mt-1 text-base leading-tight">{payload.title}</h3>
        {payload.subtitle && <p className="mt-1 text-sm text-zinc-200">{payload.subtitle}</p>}
        {payload.message && <p className="mt-2 text-sm text-zinc-100">{payload.message}</p>}
        {payload.mediaUrl && (
          <div className="mt-3 overflow-hidden rounded-xl border border-white/20 bg-black/20">
            <img src={payload.mediaUrl} alt="Notification media" className="max-h-40 w-full object-cover" />
          </div>
        )}
        {payload.ctaLabel && payload.ctaUrl && (
          <a
            href={payload.ctaUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-block rounded-lg bg-white/90 px-3 py-1.5 text-xs font-black uppercase tracking-widest text-zinc-900"
          >
            {payload.ctaLabel}
          </a>
        )}
      </div>
    </div>
  );
};

export default NotificationDeepLinkCard;
