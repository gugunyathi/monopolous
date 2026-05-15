import { getToken } from './apiService';

const API_BASE = import.meta.env.VITE_API_URL ?? '/api';

interface SendResult {
  walletAddress: string;
  sent: boolean;
  failureReason?: string;
}

export interface SendResponse {
  success: boolean;
  results: SendResult[];
  sentCount: number;
  failedCount: number;
  deduped?: boolean;
  preview?: {
    title: string;
    message: string;
    targetPath?: string;
    subtitle?: string;
    ctaLabel?: string;
    ctaUrl?: string;
    imageUrl?: string;
  };
  audienceCount?: number;
}

export interface NotificationStatus {
  appPinned: boolean;
  notificationsEnabled: boolean;
}

export interface ConsentedUser {
  address: string;
  notificationsEnabled: boolean;
}

export interface ConsentedUsersResponse {
  success: boolean;
  fetchedAt: string;
  total: number;
  users: ConsentedUser[];
}

function authHeaders(): Record<string, string> {
  const token = getToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export async function getUserNotificationStatus(walletAddress: string): Promise<NotificationStatus | null> {
  if (!walletAddress) return null;

  const response = await fetch(`${API_BASE}/notifications/user-status`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ walletAddress }),
  });

  if (!response.ok) {
    const reason = await response.text();
    throw new Error(`User notification status failed (${response.status}): ${reason}`);
  }

  return response.json() as Promise<NotificationStatus>;
}

export async function sendBroadcastNotification(params: {
  title: string;
  message: string;
  targetPath?: string;
  subtitle?: string;
  ctaLabel?: string;
  ctaUrl?: string;
  imageUrl?: string;
  mediaUrl?: string;
  section?: 'about' | 'world' | 'social' | 'posts' | 'admin';
  textColor?: string;
  fontFamily?: string;
  fontWeight?: string;
}): Promise<SendResponse | null> {
  const response = await fetch(`${API_BASE}/notifications/send-broadcast`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      title: params.title,
      message: params.message,
      targetPath: params.targetPath,
      subtitle: params.subtitle,
      ctaLabel: params.ctaLabel,
      ctaUrl: params.ctaUrl,
      imageUrl: params.imageUrl,
      mediaUrl: params.mediaUrl,
      section: params.section,
      textColor: params.textColor,
      fontFamily: params.fontFamily,
      fontWeight: params.fontWeight,
    }),
  });

  if (response.status === 401) {
    return null;
  }

  if (!response.ok) {
    const reason = await response.text();
    throw new Error(`Notification send failed (${response.status}): ${reason}`);
  }

  return response.json() as Promise<SendResponse>;
}

export async function getConsentedUsers(): Promise<ConsentedUsersResponse | null> {
  const response = await fetch(`${API_BASE}/notifications/consented-users`, {
    method: 'GET',
    headers: authHeaders(),
  });

  if (response.status === 401 || response.status === 403) {
    return null;
  }

  if (!response.ok) {
    const reason = await response.text();
    throw new Error(`Consented users fetch failed (${response.status}): ${reason}`);
  }

  return response.json() as Promise<ConsentedUsersResponse>;
}
