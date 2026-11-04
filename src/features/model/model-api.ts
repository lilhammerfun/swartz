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
export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
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
export function prepareModelConfig(
  input: ModelConfig,
  previous?: ModelConfig,
): ModelConfig {
  const baseUrl = normalizeBaseUrl(input.baseUrl);
  const model = input.model.trim();
  if (!model || model.length > 256) throw new Error("Enter a model ID.");
  const apiKey =
    input.apiKey.trim() ||
    (previous?.baseUrl === baseUrl ? previous.apiKey : "");
  if (!apiKey && !isLocalBase(baseUrl))
    throw new Error("Enter an API key for this endpoint.");
  if (/[\r\n]/.test(apiKey) || apiKey.length > 16384)
    throw new Error("Enter a valid API key.");
  return { baseUrl, model, apiKey };
}
export function modelIsConfigured(settings: ModelSettings) {
  return (
    !!settings.model && (settings.hasApiKey || isLocalBase(settings.baseUrl))
  );
}
export function providerError(status: number): string {
  if (status === 401 || status === 403)
    return "The provider rejected the API key. Check Model settings.";
  if (status === 404)
    return "Model or API endpoint not found. Check Model settings.";
  if (status === 429)
    return "The provider is rate limiting requests or the account has no quota. Try again later.";
  if (status >= 500)
    return "The model provider is temporarily unavailable. Try again later.";
  return `The model request failed (HTTP ${status}). Check Model settings.`;
}
export function parseModelAnswer(data: unknown): string {
  const body = data as {
    status?: unknown;
    output?: {
      type?: unknown;
      role?: unknown;
      content?: { type?: unknown; text?: unknown }[];
    }[];
  } | null;
  if (body?.status !== "completed") {
    if (["failed", "incomplete", "cancelled"].includes(String(body?.status)))
      throw new Error(
        "The model response was incomplete. Your question is still here.",
      );
    throw new Error("The provider returned an invalid response.");
  }
  if (!Array.isArray(body.output))
    throw new Error("The provider returned an invalid response.");
  const parts: string[] = [];
  for (const item of body.output) {
    if (item?.type !== "message" || item.role !== "assistant") continue;
    if (!Array.isArray(item.content))
      throw new Error("The provider returned an invalid response.");
    for (const block of item.content) {
      if (block?.type === "refusal")
        throw new Error("The model declined to answer this request.");
      if (block?.type !== "output_text") continue;
      if (typeof block.text !== "string")
        throw new Error("The provider returned an invalid response.");
      parts.push(block.text);
    }
  }
  const answer = parts.join("").trim();
  if (!answer)
    throw new Error("The model returned no text. Your question is still here.");
  return answer;
}
export async function requestModel(
  config: ModelConfig,
  messages: readonly ChatMessage[],
  options: ModelRequestOptions = {},
): Promise<string> {
  const base = normalizeBaseUrl(config.baseUrl);
  const model = options.model?.trim() ?? config.model;
  if (!model || model.length > 256) throw new Error("Enter a model ID.");
  if (
    options.reasoningEffort !== undefined &&
    !["none", "low", "medium", "high", "max"].includes(options.reasoningEffort)
  )
    throw new Error("Select a valid reasoning effort.");
  if (
    !messages.length ||
    messages.length > 64 ||
    messages.reduce((n, m) => n + m.content.length, 0) > 120000 ||
    messages.some((m) => !m.content.trim())
  )
    throw new Error(
      "This discussion is too long or contains invalid messages.",
    );
  let response: Response;
  try {
    response = await fetch(`${base}/responses`, {
      method: "POST",
      redirect: "error",
      headers: {
        "Content-Type": "application/json",
        ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
      },
      body: JSON.stringify({
        model,
        input: messages.map((message) => ({
          type: "message",
          role: message.role,
          content: [
            {
              type: message.role === "assistant" ? "output_text" : "input_text",
              text: message.content,
            },
          ],
        })),
        store: false,
        stream: false,
        ...(options.reasoningEffort
          ? { reasoning: { effort: options.reasoningEffort, summary: "auto" } }
          : {}),
      }),
      signal: AbortSignal.timeout(90000),
    });
  } catch (error) {
    throw new Error(
      error instanceof Error &&
        (error.name === "TimeoutError" || error.name === "AbortError")
        ? "The model request timed out. Your question is still here."
        : "Unable to reach the model provider. Check the API URL and your connection.",
    );
  }
  if (!response.ok) throw new Error(providerError(response.status));
  const reader = response.body?.getReader();
  if (!reader) throw new Error("The provider returned an invalid response.");
  const decoder = new TextDecoder();
  let text = "";
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 2 * 1024 * 1024) {
        await reader.cancel();
        throw new Error("The model response was too large.");
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
  } finally {
    reader.releaseLock();
  }
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("The provider returned an invalid response.");
  }
  return parseModelAnswer(data);
}
