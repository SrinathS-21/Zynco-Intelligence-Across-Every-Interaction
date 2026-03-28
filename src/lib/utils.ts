import humanizeDuration from "humanize-duration"
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDuration(seconds: number) {
  return humanizeDuration(seconds * 1000, {
    largest: 1,
    round: true,
    units: ["h", "m", "s"],
  })
}

/**
 * Strips HTML tags from a string and decodes basic entities
 */
export function stripHtml(html: string): string {
  if (!html) return "";

  // 1. Remove style and script tags and their content
  let text = html.replace(/<(style|script|head)[^>]*>[\s\S]*?<\/\1>/gi, "");

  // 2. Replace common block elements with newlines
  text = text.replace(/<(div|p|br|h[1-6]|li)[^>]*>/gi, "\n");

  // 3. Remove all other tags
  text = text.replace(/<[^>]+>/g, "");

  // 4. Decode common html entities
  text = text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

  // 5. Clean up multiple newlines and spaces
  return text.split('\n').map(line => line.trim()).filter(line => line).join('\n');
}
