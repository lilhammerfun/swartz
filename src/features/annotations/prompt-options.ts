import type { PromptAttachment } from "../../types/book.ts";
import type {
  ModelRequestOptions,
  ModelSettings,
  ReasoningEffort,
} from "../model/model-api.ts";

export interface PromptSubmission extends ModelRequestOptions {
  attachments: PromptAttachment[];
}

// Only offer provider capabilities we can actually send. Other endpoints keep their configured model and defaults.
export function promptChoices(settings: ModelSettings) {
  let deepseek = false;
  try {
    deepseek = new URL(settings.baseUrl).hostname === "api.deepseek.com";
  } catch {
    /* No endpoint yet. */
  }
  const models = deepseek
    ? [
        { id: "deepseek-flash", name: "DeepSeek Flash" },
        { id: "deepseek-v4-pro", name: "DeepSeek V4 Pro" },
      ]
    : [];
  if (settings.model && !models.some((model) => model.id === settings.model))
    models.unshift({ id: settings.model, name: settings.model });
  const efforts: { id: ReasoningEffort | "default"; name: string }[] = deepseek
    ? [
        { id: "none", name: "None" },
        { id: "low", name: "Low" },
        { id: "high", name: "High" },
        { id: "max", name: "Max" },
      ]
    : [{ id: "default", name: "Default" }];
  return {
    models,
    efforts,
    defaultEffort: deepseek ? ("high" as const) : ("default" as const),
  };
}
