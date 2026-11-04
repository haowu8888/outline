import { observer } from "mobx-react";
import { CloseIcon } from "outline-icons";
import * as React from "react";
import { useTranslation } from "react-i18next";
import styled from "styled-components";
import { depths, s } from "@shared/styles";
import Button from "~/components/Button";
import Flex from "~/components/Flex";
import Input from "~/components/Input";
import NudeButton from "~/components/NudeButton";
import { Portal } from "~/components/Portal";
import Text from "~/components/Text";
import useKeyDown from "~/hooks/useKeyDown";
import type { AIWritingAction, AIWritingStatus } from "../extensions/AIWriting";

type Props = {
  open: boolean;
  action: AIWritingAction;
  status: AIWritingStatus;
  output: string;
  error: string;
  /** Whether there is a selection that can be replaced. */
  canReplace: boolean;
  onRun: (instruction?: string) => void;
  onReplace: () => void;
  onInsert: () => void;
  onClose: () => void;
};

/**
 * Floating panel that streams the AI writing result and offers to insert it.
 */
function AIWritingPanel({
  open,
  action,
  status,
  output,
  error,
  canReplace,
  onRun,
  onReplace,
  onInsert,
  onClose,
}: Props) {
  const { t } = useTranslation();
  const [instruction, setInstruction] = React.useState("");

  const titles: Record<AIWritingAction, string> = {
    continue: t("Continue writing"),
    polish: t("Polish"),
    expand: t("Expand"),
    shorten: t("Make shorter"),
    summarize: t("Summarize"),
    translate_en: t("Translate to English"),
    translate_zh: t("Translate to Chinese"),
    fix: t("Fix spelling & grammar"),
    custom: t("Ask AI"),
  };

  useKeyDown("Escape", () => {
    if (open) {
      onClose();
    }
  });

  if (!open) {
    return null;
  }

  const streaming = status === "streaming";
  const done = status === "done" && !!output.trim();

  return (
    <Portal>
      <Panel column gap={8} role="dialog" aria-label={t("AI writing")}>
        <Flex justify="space-between" align="center">
          <Text weight="bold">
            {t("AI writing")} · {titles[action]}
          </Text>
          <NudeButton onClick={onClose} aria-label={t("Close")}>
            <CloseIcon />
          </NudeButton>
        </Flex>

        {action === "custom" && (
          <Flex gap={8} align="center">
            <InstructionInput
              value={instruction}
              placeholder={t("Tell AI what to write or change…")}
              onChange={(ev) => setInstruction(ev.target.value)}
              onRequestSubmit={() => instruction.trim() && onRun(instruction)}
              autoFocus
              labelHidden
              label={t("Ask AI")}
            />
            <Button
              onClick={() => onRun(instruction)}
              disabled={!instruction.trim() || streaming}
            >
              {t("Generate")}
            </Button>
          </Flex>
        )}

        {(output || streaming) && (
          <Output aria-live="polite">
            {output || <Text type="tertiary">{t("Writing…")}</Text>}
          </Output>
        )}

        {status === "error" && (
          <Text type="danger" size="small">
            {t("AI writing failed")}: {error}
          </Text>
        )}

        <Flex gap={8} justify="flex-end" wrap>
          {(done || status === "error") && action !== "custom" && (
            <Button neutral onClick={() => onRun()}>
              {t("Try again")}
            </Button>
          )}
          {done && canReplace && action !== "continue" && (
            <Button neutral onClick={onReplace}>
              {t("Replace selection")}
            </Button>
          )}
          <Button onClick={onInsert} disabled={!done}>
            {t("Insert below")}
          </Button>
        </Flex>
      </Panel>
    </Portal>
  );
}

const Panel = styled(Flex)`
  position: fixed;
  left: 50%;
  bottom: 24px;
  transform: translateX(-50%);
  width: min(640px, calc(100vw - 32px));
  max-height: 60vh;
  padding: 12px 16px;
  border-radius: 8px;
  background: ${s("menuBackground")};
  box-shadow: ${s("menuShadow")};
  z-index: ${depths.menu};
`;

const Output = styled.div`
  flex: 1;
  min-height: 48px;
  overflow-y: auto;
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 15px;
  line-height: 1.6;
  color: ${s("text")};
  padding: 8px;
  border-radius: 4px;
  background: ${s("backgroundSecondary")};
`;

const InstructionInput = styled(Input)`
  flex: 1;
  margin: 0;
`;

export default observer(AIWritingPanel);
