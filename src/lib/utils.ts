// src/lib/utils.ts
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Generate a cryptographically secure random ID.
 * Falls back to Math.random if crypto API is unavailable.
 */
export function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  
  // Fallback for environments without crypto.randomUUID
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return Array.from(bytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }
  
  // Last resort fallback (less secure, but functional)
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 15);
}

/**
 * Count words in text, stripping HTML tags.
 */
export function countWords(text: string): number {
  if (!text) return 0;
  
  const strippedText = text.replace(/<[^>]*>/g, ' ');
  const words = strippedText.trim().split(/\s+/);
  
  return words.filter(word => word.length > 0).length;
}

/** Move the item at `from` to `to` in a copy of the array. */
export function reindex<T>(items: T[], from: number, to: number): T[] {
  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

/**
 * Extract preceding context from text for AI refinement.
 */
export function extractPrecedingContext(
  fullText: string,
  selectionStart: number,
  charLimit: number = 1500
): string {
  if (!fullText || selectionStart <= 0) return '';
  
  const startIndex = Math.max(0, selectionStart - charLimit);
  return fullText.substring(startIndex, selectionStart);
}

