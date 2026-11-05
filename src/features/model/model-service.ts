import { invoke, isTauri } from "@tauri-apps/api/core";
import type { ModelConfig, ModelSettings } from "./model-api.ts";

export async function loadModelSettings(): Promise<ModelSettings> {
  if (!isTauri()) throw new Error("Open the desktop app to configure a model.");
  return invoke("load_model_settings");
}

export async function saveModelSettings(
  input: ModelConfig,
): Promise<ModelSettings> {
  if (!isTauri()) throw new Error("Open the desktop app to configure a model.");
  return invoke("save_model_settings", { input });
}
