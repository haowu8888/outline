import { observer } from "mobx-react";
import { SparklesIcon } from "outline-icons";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import styled from "styled-components";
import { s } from "@shared/styles";
import SettingRow from "~/scenes/Settings/components/SettingRow";
import Button from "~/components/Button";
import Flex from "~/components/Flex";
import Heading from "~/components/Heading";
import Input from "~/components/Input";
import Scene from "~/components/Scene";
import Switch from "~/components/Switch";
import Text from "~/components/Text";
import AIConfig from "~/utils/AIConfig";
import { client } from "~/utils/ApiClient";

type SettingsUpdate = Partial<{
  enabled: boolean;
  baseUrl: string | null;
  model: string | null;
  apiKey: string | null;
}>;

type Settings = {
  enabled: boolean;
  baseUrl: string | null;
  model: string | null;
  hasApiKey: boolean;
  defaultModel: string;
};

function AISettings() {
  const { t } = useTranslation();
  const [settings, setSettings] = React.useState<Settings>();
  const [baseUrl, setBaseUrl] = React.useState("");
  const [model, setModel] = React.useState("");
  const [apiKey, setApiKey] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [testing, setTesting] = React.useState(false);
  const [fetching, setFetching] = React.useState(false);
  const [models, setModels] = React.useState<string[]>([]);

  const apply = React.useCallback((data: Settings) => {
    setSettings(data);
    setBaseUrl(data.baseUrl ?? "");
    setModel(data.model ?? "");
    setApiKey("");
  }, []);

  React.useEffect(() => {
    void client
      .post("/ai.settings.info")
      .then((res) => apply(res.data))
      .catch((err) => toast.error(err.message));
  }, [apply]);

  const save = React.useCallback(
    async (params: SettingsUpdate) => {
      setSaving(true);
      try {
        const res = await client.post("/ai.settings.update", params);
        apply(res.data);
        AIConfig.setEnabled(
          res.data.enabled && !!res.data.baseUrl && res.data.hasApiKey
        );
        toast.success(t("Settings saved"));
      } catch (err) {
        toast.error(err.message);
      } finally {
        setSaving(false);
      }
    },
    [apply, t]
  );

  const handleSubmit = React.useCallback(
    async (ev: React.FormEvent) => {
      ev.preventDefault();
      await save({
        baseUrl: baseUrl.trim() || null,
        model: model.trim() || null,
        ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
      });
    },
    [save, baseUrl, model, apiKey]
  );

  const handleTest = React.useCallback(async () => {
    setTesting(true);
    try {
      const res = await client.post("/ai.settings.test", {
        baseUrl: baseUrl.trim() || undefined,
        model: model.trim() || undefined,
        apiKey: apiKey.trim() || undefined,
      });
      if (res.data.ok) {
        toast.success(t("Connection successful"));
      } else {
        toast.error(
          `${t("Connection failed")} (${res.data.status}) ${res.data.detail}`
        );
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setTesting(false);
    }
  }, [baseUrl, model, apiKey, t]);

  const handleFetchModels = React.useCallback(async () => {
    setFetching(true);
    try {
      const res = await client.post("/ai.settings.models", {
        baseUrl: baseUrl.trim() || undefined,
        apiKey: apiKey.trim() || undefined,
      });
      const list: string[] = res.data.models;
      setModels(list);
      if (list.length) {
        toast.success(t("Found {{ count }} models", { count: list.length }));
      } else {
        toast.error(t("The API returned no models"));
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setFetching(false);
    }
  }, [baseUrl, apiKey, t]);

  return (
    <Scene title={t("AI writing")} icon={<SparklesIcon />}>
      <Heading>{t("AI writing")}</Heading>
      <Text as="p" type="secondary">
        {t(
          "Connect an OpenAI-compatible API to enable AI writing in the editor. Changes take effect immediately without a restart."
        )}
      </Text>

      {settings && (
        <form onSubmit={handleSubmit}>
          <SettingRow
            name="enabled"
            label={t("Enable AI writing")}
            description={t(
              "Show AI writing actions in the editor toolbar and block menu"
            )}
          >
            <Switch
              id="enabled"
              checked={settings.enabled}
              onChange={(ev) => save({ enabled: ev.currentTarget.checked })}
              disabled={saving}
            />
          </SettingRow>
          <SettingRow
            name="baseUrl"
            label={t("API base URL")}
            description={t(
              "For example https://api.openai.com/v1, /v1 is added when the URL has no path"
            )}
          >
            <Input
              id="baseUrl"
              value={baseUrl}
              placeholder="https://api.openai.com/v1"
              onChange={(ev) => setBaseUrl(ev.target.value)}
            />
          </SettingRow>
          <SettingRow
            name="model"
            label={t("Model")}
            description={t("Leave empty to use {{ model }}", {
              model: settings.defaultModel,
            })}
          >
            <Flex gap={8} align="center">
              <Input
                id="model"
                value={model}
                placeholder={settings.defaultModel}
                onChange={(ev) => setModel(ev.target.value)}
                flex
              />
              <Button
                type="button"
                neutral
                onClick={handleFetchModels}
                disabled={fetching}
              >
                {fetching ? `${t("Fetching")}…` : t("Fetch models")}
              </Button>
            </Flex>
            {models.length > 0 && (
              <ModelSelect
                aria-label={t("Available models")}
                value={models.includes(model) ? model : ""}
                onChange={(ev) => setModel(ev.target.value)}
              >
                <option value="" disabled>
                  {t("Choose from {{ count }} models", {
                    count: models.length,
                  })}
                </option>
                {models.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </ModelSelect>
            )}
          </SettingRow>
          <SettingRow
            name="apiKey"
            label={t("API key")}
            description={
              settings.hasApiKey
                ? t("A key is saved. Leave empty to keep it.")
                : t("Stored encrypted and never shown again.")
            }
          >
            <Input
              id="apiKey"
              type="password"
              value={apiKey}
              autoComplete="off"
              placeholder={settings.hasApiKey ? "••••••••" : "sk-…"}
              onChange={(ev) => setApiKey(ev.target.value)}
            />
          </SettingRow>
          <Flex gap={8}>
            <Button type="submit" disabled={saving}>
              {saving ? `${t("Saving")}…` : t("Save")}
            </Button>
            <Button
              type="button"
              neutral
              onClick={handleTest}
              disabled={testing}
            >
              {testing ? `${t("Testing")}…` : t("Test connection")}
            </Button>
            {settings.hasApiKey && (
              <Button
                type="button"
                neutral
                onClick={() => save({ apiKey: null })}
                disabled={saving}
              >
                {t("Remove key")}
              </Button>
            )}
          </Flex>
        </form>
      )}
    </Scene>
  );
}

const ModelSelect = styled.select`
  width: 100%;
  margin-bottom: 16px;
  padding: 6px 8px;
  border: 1px solid ${s("inputBorder")};
  border-radius: 4px;
  background: ${s("background")};
  color: ${s("text")};
  font: inherit;
`;

export default observer(AISettings);
