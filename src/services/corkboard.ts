// src/services/corkboard.ts
//
// The corkboard's card arrangement, one JSON value per novel. 'custom' order
// is a planning artifact: the server stores it beside — never inside — the
// manuscript's real chapter order.

import { API_URL } from '@/services/apiBase';

export type CorkboardMode = 'manuscript' | 'custom';

export interface CorkboardArrangement {
  mode: CorkboardMode;
  /** Chapter ids. May contain stale ids or miss new chapters — reconcile. */
  order: string[];
}

export async function fetchCorkboard(novelId: string): Promise<CorkboardArrangement> {
  const response = await fetch(`${API_URL}/api/novels/${novelId}/corkboard`);
  if (!response.ok) throw new Error('Failed to load the corkboard');
  return response.json();
}

export async function saveCorkboard(
  novelId: string,
  arrangement: CorkboardArrangement
): Promise<CorkboardArrangement> {
  const response = await fetch(`${API_URL}/api/novels/${novelId}/corkboard`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(arrangement),
  });
  if (!response.ok) throw new Error('Failed to save the corkboard');
  return response.json();
}
