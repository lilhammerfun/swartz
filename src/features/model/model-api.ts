export interface ModelConfig {
  baseUrl: string;
  model: string;
  apiKey: string;
}
export interface ModelSettings {
  baseUrl: string;
  model: string;
  hasApiKey: boolean;
}
export type ReasoningEffort = "none" | "low" | "medium" | "high" | "max";
export interface ModelRequestOptions {
  model?: string;
  reasoningEffort?: ReasoningEffort;
}
export const defaultModelSettings: ModelSettings = {
  baseUrl: "",
  model: "",
  hasApiKey: false,
};

export function normalizeBaseUrl(base: string): string {
  let url: URL;
  try {
    url = new URL(base.trim());
  } catch {
    throw new Error("Enter a valid API base URL.");
  }
  if (
    (url.protocol !== "https:" &&
      !(url.protocol === "http:" && isLocalUrl(url))) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw new Error(
      "Use an HTTPS base URL, or HTTP for a local model. Keep credentials out of the URL.",
    );
  return url.toString().replace(/\/+$/, "");
}
function isLocalUrl(url: URL) {
  return ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
}
export function isLocalBase(base: string) {
  try {
    return isLocalUrl(new URL(base));
  } catch {
    return false;
  }
}
export function modelIsConfigured(settings: ModelSettings) {
  return (
    !!settings.model && (settings.hasApiKey || isLocalBase(settings.baseUrl))
  );
}
