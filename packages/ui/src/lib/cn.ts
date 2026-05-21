import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Combines class names with Tailwind merge (per `35-graphic-templates.md`). */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
