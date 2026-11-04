import * as React from "react";
import { useTranslation } from "react-i18next";
import styled from "styled-components";
import Flex from "@shared/components/Flex";
import { s } from "@shared/styles";
import Button from "~/components/Button";
import Input from "~/components/Input";
import Text from "~/components/Text";
import { client } from "~/utils/ApiClient";

type Props = {
  /** The share id or url slug being viewed. */
  shareId: string;
  /** Called once the password was accepted. */
  onUnlocked: () => void;
};

/**
 * Asks an anonymous visitor for the password of a protected share link.
 */
export default function SharePasswordPrompt({ shareId, onUnlocked }: Props) {
  const { t } = useTranslation();
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  const handleSubmit = React.useCallback(
    async (ev?: React.SyntheticEvent) => {
      ev?.preventDefault();
      if (!password || submitting) {
        return;
      }
      setSubmitting(true);
      setError("");
      try {
        await client.post("/shares.unlock", { shareId, password });
        onUnlocked();
      } catch (_err) {
        setError(t("Incorrect password, please try again"));
      } finally {
        setSubmitting(false);
      }
    },
    [password, submitting, shareId, onUnlocked, t]
  );

  return (
    <Centered>
      <Card as="form" onSubmit={handleSubmit} column gap={12}>
        <Title>{t("This document is password protected")}</Title>
        <Text type="secondary">
          {t("Enter the password to view the shared document.")}
        </Text>
        <Input
          type="password"
          value={password}
          autoFocus
          label={t("Password")}
          labelHidden
          placeholder={t("Password")}
          error={error}
          onChange={(ev) => setPassword(ev.target.value)}
          margin={0}
        />
        <Button type="submit" disabled={!password || submitting} fullwidth>
          {t("View document")}
        </Button>
      </Card>
    </Centered>
  );
}

/**
 * Shown when an anonymous visitor opens a share link that has expired.
 */
export function ShareExpired() {
  const { t } = useTranslation();
  return (
    <Centered>
      <Card column gap={12}>
        <Title>{t("This share link has expired")}</Title>
        <Text type="secondary">
          {t("Ask the owner of the document for a new link.")}
        </Text>
      </Card>
    </Centered>
  );
}

const Centered = styled(Flex)`
  min-height: 100vh;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: ${s("background")};
`;

const Card = styled(Flex)`
  width: 100%;
  max-width: 360px;
`;

const Title = styled.h2`
  margin: 0;
  color: ${s("text")};
`;
