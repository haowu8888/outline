import { observer } from "mobx-react";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import styled from "styled-components";
import Flex from "@shared/components/Flex";
import Share from "~/models/Share";
import Button from "~/components/Button";
import Input from "~/components/Input";
import InputSelect from "~/components/InputSelect";
import Text from "~/components/Text";
import useStores from "~/hooks/useStores";
import { client } from "~/utils/ApiClient";
import { ListItem } from "../components/ListItem";

type Props = {
  /** The published share to protect. */
  share: Share;
};

const DAY = 24 * 60 * 60 * 1000;
const EXPIRY_DAYS = ["1", "7", "30", "90"];

/**
 * Password and expiry controls for an anonymous (published) share link.
 */
function ShareProtection({ share }: Props) {
  const { t } = useTranslation();
  const { shares } = useStores();
  const [password, setPassword] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const update = React.useCallback(
    async (params: Record<string, unknown>) => {
      setSaving(true);
      try {
        const res = await client.post("/shares.update", {
          id: share.id,
          ...params,
        });
        shares.add(res.data);
        return true;
      } catch (err) {
        toast.error(err.message);
        return false;
      } finally {
        setSaving(false);
      }
    },
    [share.id, shares]
  );

  const handleSetPassword = React.useCallback(async () => {
    if (!password) {
      return;
    }
    if (await update({ password })) {
      setPassword("");
      toast.success(t("Share password saved"));
    }
  }, [password, update, t]);

  const handleClearPassword = React.useCallback(async () => {
    if (await update({ password: null })) {
      toast.success(t("Share password removed"));
    }
  }, [update, t]);

  const handleExpiryChange = React.useCallback(
    async (value: string | null) => {
      if (!value || value === "current") {
        return;
      }
      const expiresAt =
        value === "never"
          ? null
          : new Date(Date.now() + Number(value) * DAY).toISOString();
      return update({ expiresAt });
    },
    [update]
  );

  const expiresAt = share.expiresAt ? new Date(share.expiresAt) : null;
  const expired = !!expiresAt && expiresAt.getTime() <= Date.now();
  const expiryOptions = [
    ...(expiresAt ? [{ label: t("Keep current"), value: "current" }] : []),
    { label: t("Never expires"), value: "never" },
    ...EXPIRY_DAYS.map((days) => ({
      label: t("{{ days }} days", { days }),
      value: days,
    })),
  ];

  return (
    <>
      <ListItem
        title={<Text type="tertiary">{t("Access password")}</Text>}
        subtitle={
          share.hasPassword
            ? t("Visitors must enter the password to view")
            : t("Anyone with the link can view without a password")
        }
        actions={
          share.hasPassword ? (
            <Button neutral onClick={handleClearPassword} disabled={saving}>
              {t("Remove")}
            </Button>
          ) : null
        }
      />
      <Flex gap={8} align="center">
        <PasswordInput
          type="password"
          value={password}
          placeholder={
            share.hasPassword ? t("Enter a new password") : t("Set a password")
          }
          onChange={(ev) => setPassword(ev.target.value)}
          onRequestSubmit={handleSetPassword}
          autoComplete="new-password"
          labelHidden
          label={t("Access password")}
        />
        <Button
          onClick={handleSetPassword}
          disabled={!password || saving}
          neutral
        >
          {t("Save")}
        </Button>
      </Flex>
      <ListItem
        title={<Text type="tertiary">{t("Link expiry")}</Text>}
        subtitle={
          expiresAt
            ? expired
              ? t("Expired on {{ date }}", {
                  date: expiresAt.toLocaleString(),
                })
              : t("Expires on {{ date }}", {
                  date: expiresAt.toLocaleString(),
                })
            : t("The link never expires")
        }
        actions={
          <InputSelect
            ariaLabel={t("Link expiry")}
            label={t("Link expiry")}
            labelHidden
            nude
            short
            value={expiresAt ? "current" : "never"}
            options={expiryOptions}
            onChange={handleExpiryChange}
            disabled={saving}
          />
        }
      />
    </>
  );
}

const PasswordInput = styled(Input)`
  flex: 1;
  margin: 0;
`;

export default observer(ShareProtection);
