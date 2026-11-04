import { PadlockIcon } from "outline-icons";
import * as React from "react";
import { useTranslation } from "react-i18next";
import styled from "styled-components";
import { s } from "../../../styles";
import {
  EncryptedData,
  canEncrypt,
  decryptText,
  encryptText,
} from "../../lib/smartBlocks";
import {
  BlockProps,
  BlockTitle,
  Button,
  ErrorText,
  Hint,
  Input,
  Row,
} from "./common";

const MIN_PASSWORD = 4;

export default function Encrypted({
  data,
  editable,
  update,
}: BlockProps<EncryptedData>) {
  const { t } = useTranslation();
  const configured = !!data.ciphertext;
  const [password, setPassword] = React.useState("");
  // The decrypted text only lives in memory while the block is unlocked.
  const [text, setText] = React.useState<string | null>(configured ? null : "");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      if (!canEncrypt()) {
        throw new Error(t("Encrypted text requires HTTPS"));
      }
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const unlock = () =>
    run(async () => {
      try {
        setText(await decryptText(data, password));
      } catch {
        throw new Error(t("Wrong password"));
      }
    });

  const lock = () =>
    run(async () => {
      if (password.length < MIN_PASSWORD) {
        throw new Error(
          t("Password must be at least {{ count }} characters", {
            count: MIN_PASSWORD,
          })
        );
      }
      if (!text?.trim()) {
        throw new Error(t("Enter the text to encrypt"));
      }
      const encrypted = await encryptText(data, password, text);
      update((value) => ({ ...encrypted, title: value.title }));
      setText(null);
      setPassword("");
    });

  const relock = () => {
    setText(null);
    setPassword("");
    setError("");
  };

  return (
    <>
      <Header>
        <PadlockIcon size={20} />
        <BlockTitle
          value={editable ? data.title : data.title || t("Encrypted text")}
          placeholder={t("Encrypted text")}
          editable={editable}
          onCommit={(title) => update((value) => ({ ...value, title }))}
        />
      </Header>
      {text === null ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void unlock();
          }}
        >
          <Row>
            <Input
              type="password"
              value={password}
              autoComplete="off"
              placeholder={t("Enter the password to view")}
              aria-label={t("Password")}
              onChange={(event) => setPassword(event.target.value)}
            />
            <Button type="submit" $primary disabled={busy || !password}>
              {t("Unlock")}
            </Button>
          </Row>
        </form>
      ) : (
        <>
          {editable ? (
            <Plain
              rows={4}
              value={text}
              placeholder={t("Only people who know the password can read this")}
              aria-label={t("Encrypted text")}
              onChange={(event) => setText(event.target.value)}
            />
          ) : (
            <Revealed>{text}</Revealed>
          )}
          {editable ? (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void lock();
              }}
            >
              <Row>
                <Input
                  type="password"
                  value={password}
                  autoComplete="new-password"
                  placeholder={
                    configured
                      ? t("Password to save with")
                      : t("Set a password")
                  }
                  aria-label={t("Password")}
                  onChange={(event) => setPassword(event.target.value)}
                />
                <Button type="submit" $primary disabled={busy}>
                  {t("Encrypt and save")}
                </Button>
                {configured && (
                  <Button type="button" onClick={relock}>
                    {t("Lock")}
                  </Button>
                )}
              </Row>
              <Hint>
                {t(
                  "The text is encrypted in your browser, the password is not stored and can not be recovered."
                )}
              </Hint>
            </form>
          ) : (
            <Row>
              <Button type="button" onClick={relock}>
                {t("Lock")}
              </Button>
            </Row>
          )}
        </>
      )}
      {error && <ErrorText>{error}</ErrorText>}
    </>
  );
}

const Header = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;

  > :last-child {
    flex: 1;
    margin-bottom: 0;
  }
`;

const Plain = styled.textarea`
  width: 100%;
  margin-top: 8px;
  padding: 6px 8px;
  border: 1px solid ${s("inputBorder")};
  border-radius: 4px;
  background: ${s("background")};
  color: ${s("text")};
  font: inherit;
  resize: vertical;
`;

const Revealed = styled.div`
  margin-top: 8px;
  padding: 8px;
  border-radius: 4px;
  background: ${s("backgroundSecondary")};
  white-space: pre-wrap;
  word-break: break-word;
`;
