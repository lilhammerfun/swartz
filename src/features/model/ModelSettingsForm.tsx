import { useEffect, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { SettingRow } from "@/components/ui/settings-layout";
import { RuntimeErrorNotice } from "@/components/ui/feedback";
import {
  normalizeBaseUrl,
  isLocalBase,
  type ModelConfig,
  type ModelSettings,
} from "./model-api";

export function ModelSettingsForm({
  settings,
  loadError,
  onSave,
}: {
  settings: ModelSettings;
  loadError: string;
  onSave: (input: ModelConfig) => Promise<void>;
}) {
  const backendAvailable = isTauri();
  const [baseUrl, setBaseUrl] = useState(settings.baseUrl);
  const [model, setModel] = useState(settings.model);
  const [apiKey, setApiKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    setBaseUrl(settings.baseUrl);
    setModel(settings.model);
    setApiKey("");
    setError("");
  }, [settings]);
  let sameEndpoint = false;
  try {
    sameEndpoint = normalizeBaseUrl(baseUrl) === settings.baseUrl;
  } catch {
    /* Validation is reported on save. */
  }
  const keepingKey = settings.hasApiKey && sameEndpoint;
  return (
    <form
      aria-label="Model settings"
      onChange={() => {
        setSaved(false);
        setError("");
      }}
      onSubmit={(event) => {
        event.preventDefault();
        if (saving || !backendAvailable) return;
        setSaving(true);
        setSaved(false);
        setError("");
        void onSave({ baseUrl, model, apiKey })
          .then(() => {
            setApiKey("");
            setSaved(true);
          })
          .catch((reason) =>
            setError(reason instanceof Error ? reason.message : String(reason)),
          )
          .finally(() => setSaving(false));
      }}
      className="space-y-4"
    >
      <div className="setting-group">
        <SettingRow
          label="API base URL"
          htmlFor="model-base-url"
          description="Requires support for the Responses API."
        >
          <Input
            id="model-base-url"
            type="url"
            value={baseUrl}
            onChange={(event) => setBaseUrl(event.currentTarget.value)}
            disabled={saving || !backendAvailable}
            required
            placeholder="e.g. https://api.deepseek.com"
            aria-describedby="model-base-url-description"
            autoComplete="off"
            spellCheck={false}
          />
        </SettingRow>
        <SettingRow
          label="Model ID"
          htmlFor="model-id"
          description="The model identifier from your provider."
        >
          <Input
            id="model-id"
            value={model}
            onChange={(event) => setModel(event.currentTarget.value)}
            disabled={saving || !backendAvailable}
            required
            placeholder="e.g. deepseek-flash"
            aria-describedby="model-id-description"
            autoComplete="off"
            spellCheck={false}
          />
        </SettingRow>
        <SettingRow
          label="API key"
          htmlFor="model-api-key"
          description={
            backendAvailable
              ? "Stored securely in your system keyring."
              : "Open the desktop app to configure model access."
          }
        >
          <PasswordInput
            id="model-api-key"
            value={apiKey}
            onChange={(event) => setApiKey(event.currentTarget.value)}
            disabled={saving || !backendAvailable}
            required={!keepingKey && !isLocalBase(baseUrl)}
            placeholder={
              keepingKey ? "Leave blank to keep the saved key" : "API key"
            }
            aria-describedby="model-api-key-description"
            autoComplete="off"
            spellCheck={false}
          />
        </SettingRow>
      </div>
      {(error || loadError) && (
        <RuntimeErrorNotice
          title={
            loadError
              ? "Could not load model settings"
              : "Could not save model settings"
          }
        >
          {error || loadError}
        </RuntimeErrorNotice>
      )}
      <div className="flex items-center justify-end gap-3">
        <span role="status" className="text-xs text-muted-foreground">
          {saved ? "Saved" : ""}
        </span>
        <Button
          variant="outline"
          type="submit"
          loading={saving}
          size="sm"
          disabled={
            saving || !backendAvailable || !model.trim() || !baseUrl.trim()
          }
        >
          Save changes
        </Button>
      </div>
    </form>
  );
}
