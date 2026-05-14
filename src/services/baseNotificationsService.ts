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
}

export interface NotificationStatus {
  appPinned: boolean;
  notificationsEnabled: boolean;
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
}): Promise<SendResponse | null> {
  const response = await fetch(`${API_BASE}/notifications/send-broadcast`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      title: params.title,
      message: params.message,
      targetPath: params.targetPath,
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
