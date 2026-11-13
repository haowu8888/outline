import { observer } from "mobx-react";
import { PadlockIcon } from "outline-icons";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import SettingRow from "~/scenes/Settings/components/SettingRow";
import Button from "~/components/Button";
import Heading from "~/components/Heading";
import Input from "~/components/Input";
import Scene from "~/components/Scene";
import Text from "~/components/Text";
import { client } from "~/utils/ApiClient";

const MIN_PASSWORD_LENGTH = 8;

type Info = {
  hasPassword: boolean;
  email: string | null;
};

function PasswordSettings() {
  const { t } = useTranslation();
  const [info, setInfo] = React.useState<Info>();
  const [currentPassword, setCurrentPassword] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    void client
      .post("/password.info")
      .then((res) => setInfo(res.data))
      .catch((err) => toast.error(err.message));
  }, []);

  const handleSubmit = async (ev: React.SyntheticEvent) => {
    ev.preventDefault();

    if (password !== confirm) {
      toast.error(t("The passwords do not match"));
      return;
    }

    setSaving(true);
    try {
      await client.post("/password.update", {
        currentPassword: info?.hasPassword ? currentPassword : undefined,
        password,
      });
      setInfo((prev) => (prev ? { ...prev, hasPassword: true } : prev));
      setCurrentPassword("");
      setPassword("");
      setConfirm("");
      toast.success(t("Password saved"));
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Scene title={t("Password")} icon={<PadlockIcon />}>
      <Heading>{t("Password")}</Heading>
      <Text as="p" type="secondary">
        {info?.email
          ? t(
              "Sign in with your email address {{ email }} and this password.",
              { email: info.email }
            )
          : t("Your account has no email address, password sign-in needs one.")}
      </Text>

      {info && (
        <form onSubmit={handleSubmit}>
          {info.hasPassword && (
            <SettingRow name="currentPassword" label={t("Current password")}>
              <Input
                id="currentPassword"
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(ev) => setCurrentPassword(ev.target.value)}
                required
              />
            </SettingRow>
          )}
          <SettingRow
            name="password"
            label={t("New password")}
            description={t("At least {{ count }} characters", {
              count: MIN_PASSWORD_LENGTH,
            })}
          >
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              value={password}
              minLength={MIN_PASSWORD_LENGTH}
              onChange={(ev) => setPassword(ev.target.value)}
              required
            />
          </SettingRow>
          <SettingRow
            border={false}
            name="confirm"
            label={t("Confirm new password")}
          >
            <Input
              id="confirm"
              type="password"
              autoComplete="new-password"
              value={confirm}
              minLength={MIN_PASSWORD_LENGTH}
              onChange={(ev) => setConfirm(ev.target.value)}
              required
            />
          </SettingRow>
          <Button type="submit" disabled={saving || !info.email}>
            {saving ? `${t("Saving")}…` : t("Save")}
          </Button>
        </form>
      )}
    </Scene>
  );
}

export default observer(PasswordSettings);
