import { useEffect, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Field,
  FieldGroup,
  FieldContent,
  FieldLabel,
  FieldDescription,
} from "@/components/ui/field";
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
        if (saving) return;
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
      <Card className="gap-0 py-0 ring-border/60">
        <FieldGroup className="gap-0 divide-y divide-border/60">
          <Field
            orientation="horizontal"
            className="grid grid-cols-1 items-center gap-3 p-4 has-[>[data-slot=field-content]]:items-center @min-[520px]/field-group:grid-cols-[1fr_264px] @min-[520px]/field-group:gap-6"
          >
            <FieldContent className="min-w-0 gap-1">
              <FieldLabel htmlFor="model-base-url" className="text-[13px]">
                API base URL
              </FieldLabel>
              <FieldDescription
                id="model-base-url-description"
                className="text-xs leading-5"
              >
                Your OpenAI-compatible API endpoint.
              </FieldDescription>
            </FieldContent>
            <Input
              id="model-base-url"
              type="url"
              value={baseUrl}
              onChange={(event) => setBaseUrl(event.currentTarget.value)}
              disabled={saving}
              required
              placeholder="e.g. https://api.deepseek.com"
              aria-describedby="model-base-url-description"
              autoComplete="off"
              spellCheck={false}
              className="bg-background text-[13px] md:text-[13px]"
            />
          </Field>
          <Field
            orientation="horizontal"
            className="grid grid-cols-1 items-center gap-3 p-4 has-[>[data-slot=field-content]]:items-center @min-[520px]/field-group:grid-cols-[1fr_264px] @min-[520px]/field-group:gap-6"
          >
            <FieldContent className="min-w-0 gap-1">
              <FieldLabel htmlFor="model-id" className="text-[13px]">
                Model ID
              </FieldLabel>
              <FieldDescription
                id="model-id-description"
                className="text-xs leading-5"
              >
                The model identifier from your provider.
              </FieldDescription>
            </FieldContent>
            <Input
              id="model-id"
              value={model}
              onChange={(event) => setModel(event.currentTarget.value)}
              disabled={saving}
              required
              placeholder="e.g. deepseek-flash"
              aria-describedby="model-id-description"
              autoComplete="off"
              spellCheck={false}
              className="bg-background text-[13px] md:text-[13px]"
            />
          </Field>
          <Field
            orientation="horizontal"
            className="grid grid-cols-1 items-center gap-3 p-4 has-[>[data-slot=field-content]]:items-center @min-[520px]/field-group:grid-cols-[1fr_264px] @min-[520px]/field-group:gap-6"
          >
            <FieldContent className="min-w-0 gap-1">
              <FieldLabel htmlFor="model-api-key" className="text-[13px]">
                API key
              </FieldLabel>
              <FieldDescription
                id="model-api-key-description"
                className="text-xs leading-5"
              >
                {isTauri()
                  ? "Stored securely in your system keyring."
                  : "Settings stay in memory for this preview session."}
              </FieldDescription>
            </FieldContent>
            <Input
              id="model-api-key"
              type="password"
              value={apiKey}
              onChange={(event) => setApiKey(event.currentTarget.value)}
              disabled={saving}
              required={!keepingKey && !isLocalBase(baseUrl)}
              placeholder={
                keepingKey ? "Leave blank to keep the saved key" : "API key"
              }
              aria-describedby="model-api-key-description"
              autoComplete="off"
              spellCheck={false}
              className="bg-background text-[13px] md:text-[13px]"
            />
          </Field>
        </FieldGroup>
      </Card>
      {(error || loadError) && (
        <Alert variant="destructive">
          <AlertDescription>{error || loadError}</AlertDescription>
        </Alert>
      )}
      <div className="flex items-center justify-end gap-3">
        <span role="status" className="text-xs text-muted-foreground">
          {saved ? "Saved" : ""}
        </span>
        <Button
          variant="outline"
          type="submit"
          size="sm"
          disabled={saving || !model.trim() || !baseUrl.trim()}
        >
          {saving && <LoaderCircle className="animate-spin" />}Save changes
        </Button>
      </div>
    </form>
  );
}
