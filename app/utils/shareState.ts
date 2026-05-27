// app/utils/shareState.ts

export interface ShareState {
  repoUrl?: string;
  filter?: { type: string; value: string } | null;
  viewport?: { x: number; y: number; zoom: number };
}

/**
 * Encodes the current application state into a URL-safe Base64 string.
 */
export function encodeShareState(state: ShareState): string {
  try {
    const jsonStr = JSON.stringify(state);
    // Use btoa for Base64 encoding. encodeURIComponent ensures UTF-8 safety.
    return btoa(encodeURIComponent(jsonStr));
  } catch (error) {
    console.error("Failed to encode share state", error);
    return "";
  }
}

/**
 * Decodes a URL-safe Base64 string back into the application state object.
 */
export function decodeShareState(encodedStr: string): ShareState | null {
  try {
    if (!encodedStr) return null;
    const jsonStr = decodeURIComponent(atob(encodedStr));
    return JSON.parse(jsonStr) as ShareState;
  } catch (error) {
    console.error("Failed to decode share state", error);
    return null;
  }
}
