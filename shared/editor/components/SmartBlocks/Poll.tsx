import { CheckmarkIcon, CloseIcon } from "outline-icons";
import * as React from "react";
import { useTranslation } from "react-i18next";
import styled from "styled-components";
import { s } from "../../../styles";
import { PollData, blockId } from "../../lib/smartBlocks";
import { AddInput } from "./Kanban";
import {
  BlockProps,
  BlockTitle,
  Button,
  Hint,
  IconButton,
  Row,
  TextField,
} from "./common";

const MIN_OPTIONS = 2;
const PERCENT = 100;

export default function Poll({
  data,
  editable,
  update,
  userId,
}: BlockProps<PollData>) {
  const { t } = useTranslation();
  const options = data.options.filter((option) => option.text.trim());
  // A poll without options opens in edit mode so that it can be set up.
  const [editing, setEditing] = React.useState(
    editable && options.length < MIN_OPTIONS
  );
  const voters = Object.keys(data.votes).length;
  const mine = (userId && data.votes[userId]) || [];
  const canVote = editable && !!userId && !editing;

  const vote = (optionId: string) => {
    if (!userId) {
      return;
    }
    update((value) => {
      const current = value.votes[userId] ?? [];
      const chosen = current.includes(optionId);
      const next = value.multiple
        ? chosen
          ? current.filter((item) => item !== optionId)
          : [...current, optionId]
        : chosen
        ? []
        : [optionId];
      const votes = { ...value.votes };
      if (next.length) {
        votes[userId] = next;
      } else {
        delete votes[userId];
      }
      return { ...value, votes };
    });
  };

  if (editing) {
    return (
      <>
        <BlockTitle
          value={data.title}
          placeholder={t("Poll question")}
          editable
          onCommit={(title) => update((value) => ({ ...value, title }))}
        />
        {data.options.map((option, index) => (
          <Row key={option.id}>
            <TextField
              value={option.text}
              placeholder={`${t("Option")} ${index + 1}`}
              aria-label={`${t("Option")} ${index + 1}`}
              onCommit={(text) =>
                update((value) => ({
                  ...value,
                  options: value.options.map((item) =>
                    item.id === option.id ? { ...item, text } : item
                  ),
                }))
              }
            />
            <IconButton
              type="button"
              title={t("Delete option")}
              aria-label={t("Delete option")}
              disabled={data.options.length <= MIN_OPTIONS}
              onClick={() =>
                update((value) => ({
                  ...value,
                  options: value.options.filter(
                    (item) => item.id !== option.id
                  ),
                }))
              }
            >
              <CloseIcon size={18} />
            </IconButton>
          </Row>
        ))}
        <AddInput
          placeholder={t("Add an option")}
          onAdd={(text) =>
            update((value) => ({
              ...value,
              options: [...value.options, { id: blockId(), text }],
            }))
          }
        />
        <Row>
          <label>
            <input
              type="checkbox"
              checked={data.multiple}
              onChange={(event) => {
                const multiple = event.target.checked;
                update((value) => ({
                  ...value,
                  multiple,
                  votes: multiple
                    ? value.votes
                    : Object.fromEntries(
                        Object.entries(value.votes).map(([id, selected]) => [
                          id,
                          selected.slice(0, 1),
                        ])
                      ),
                }));
              }}
            />{" "}
            {t("Allow multiple choices")}
          </label>
          <Button type="button" $primary onClick={() => setEditing(false)}>
            {t("Done")}
          </Button>
        </Row>
      </>
    );
  }

  return (
    <>
      <BlockTitle
        value={data.title || t("Poll")}
        placeholder={t("Poll")}
        editable={false}
        onCommit={() => undefined}
      />
      <Hint>
        {data.multiple ? t("Multiple choice") : t("Single choice")} ·{" "}
        {t("{{ count }} voter", { count: voters })}
      </Hint>
      <Options role={data.multiple ? "group" : "radiogroup"}>
        {options.map((option) => {
          const count = Object.values(data.votes).filter((selected) =>
            selected.includes(option.id)
          ).length;
          const percent = voters ? Math.round((count / voters) * PERCENT) : 0;
          const chosen = mine.includes(option.id);
          return (
            <OptionButton
              key={option.id}
              type="button"
              role={data.multiple ? "checkbox" : "radio"}
              aria-checked={chosen}
              disabled={!canVote}
              $chosen={chosen}
              onClick={() => vote(option.id)}
            >
              <Bar style={{ width: `${percent}%` }} />
              <Mark $chosen={chosen} $round={!data.multiple}>
                {chosen && <CheckmarkIcon size={16} />}
              </Mark>
              <Label>{option.text}</Label>
              <Hint>
                {count} · {percent}%
              </Hint>
            </OptionButton>
          );
        })}
      </Options>
      {editable && (
        <Row>
          <Button type="button" onClick={() => setEditing(true)}>
            {t("Edit poll")}
          </Button>
          {voters > 0 && (
            <Button
              type="button"
              onClick={() => {
                if (window.confirm(t("Clear all votes?"))) {
                  update((value) => ({ ...value, votes: {} }));
                }
              }}
            >
              {t("Clear votes")}
            </Button>
          )}
        </Row>
      )}
    </>
  );
}

const Options = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 8px;
`;

const OptionButton = styled.button<{ $chosen: boolean }>`
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border: 1px solid
    ${(props) => (props.$chosen ? props.theme.accent : props.theme.divider)};
  border-radius: 6px;
  background: ${s("background")};
  color: ${s("text")};
  font: inherit;
  text-align: left;
  overflow: hidden;
  cursor: pointer;

  &:disabled {
    cursor: default;
  }

  > * {
    position: relative;
  }
`;

const Bar = styled.span`
  position: absolute !important;
  inset: 0 auto 0 0;
  background: ${s("backgroundSecondary")};
  transition: width 200ms ease-in-out;
`;

const Mark = styled.span<{ $chosen: boolean; $round: boolean }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 18px;
  height: 18px;
  border: 1px solid
    ${(props) => (props.$chosen ? props.theme.accent : props.theme.inputBorder)};
  border-radius: ${(props) => (props.$round ? "50%" : "4px")};
  background: ${(props) =>
    props.$chosen ? props.theme.accent : props.theme.background};
  color: ${s("accentText")};
`;

const Label = styled.span`
  flex: 1;
  word-break: break-word;
`;
