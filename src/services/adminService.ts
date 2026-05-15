import { getToken } from './apiService';

const API_BASE = import.meta.env.VITE_API_URL ?? '/api';

export interface AdminOverviewResponse {
  success: boolean;
  generatedAt: string;
  counts: {
    users: number;
    sessions: number;
    activeSessions: number;
    trades: number;
    tokenLaunches: number;
    socialPosts: number;
  };
  latestUsers: Array<{
    address: string;
    displayName?: string;
    totalGamesPlayed: number;
    lastActiveAt: string;
  }>;
}

function authHeaders(): Record<string, string> {
  const token = getToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export async function getAdminOverview(): Promise<AdminOverviewResponse | null> {
  const response = await fetch(`${API_BASE}/admin/overview`, {
    method: 'GET',
    headers: authHeaders(),
  });

  if (response.status === 401 || response.status === 403) {
    return null;
  }

  if (!response.ok) {
    const reason = await response.text();
    throw new Error(`Admin overview fetch failed (${response.status}): ${reason}`);
  }

  return response.json() as Promise<AdminOverviewResponse>;
}
