import { invoke, isTauri } from "@tauri-apps/api/core";
import {
  defaultModelSettings,
  prepareModelConfig,
  requestModel,
  type ModelConfig,
  type ModelSettings,
  type ChatMessage,
  type ModelRequestOptions,
} from "./model-api";

// Browser preview retains credentials only in this page's memory; native keys stay in the OS keyring.
let previewConfig: ModelConfig | undefined;
export async function loadModelSettings(): Promise<ModelSettings> {
  if (isTauri()) return invoke("load_model_settings");
  return previewConfig
    ? {
        baseUrl: previewConfig.baseUrl,
        model: previewConfig.model,
        hasApiKey: !!previewConfig.apiKey,
      }
    : defaultModelSettings;
}
export async function saveModelSettings(
  input: ModelConfig,
): Promise<ModelSettings> {
  if (isTauri()) return invoke("save_model_settings", { input });
  previewConfig = prepareModelConfig(input, previewConfig);
  return {
    baseUrl: previewConfig.baseUrl,
    model: previewConfig.model,
    hasApiKey: !!previewConfig.apiKey,
  };
}
export async function askModel(
  messages: ChatMessage[],
  options: ModelRequestOptions = {},
): Promise<string> {
  if (isTauri()) {
    return invoke("ask_model", {
      messages,
      options: {
        model: options.model,
        reasoningEffort: options.reasoningEffort,
      },
    });
  }
  if (!previewConfig) throw new Error("Configure a model in Settings first.");
  return requestModel(previewConfig, messages, options);
}
