import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}

export function countWords(text: string): number {
  const strippedText = text.replace(/<[^>]*>/g, ' ');
  return strippedText
    .trim()
    .split(/\s+/)
    .filter(word => word.length > 0).length;
}

export function extractPrecedingContext(
  fullText: string,
  selectionStart: number,
  charLimit: number = 1500
): string {
  const startIndex = Math.max(0, selectionStart - charLimit);
  return fullText.substring(startIndex, selectionStart);
}

export function debounce<T extends (...args: Parameters<T>) => ReturnType<T>>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}