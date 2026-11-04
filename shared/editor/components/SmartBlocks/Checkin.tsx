import { CloseIcon, DoneIcon } from "outline-icons";
import * as React from "react";
import { useTranslation } from "react-i18next";
import styled from "styled-components";
import { s } from "../../../styles";
import { CheckinData, blockId, localDate } from "../../lib/smartBlocks";
import {
  BlockProps,
  BlockTitle,
  Button,
  Empty,
  IconButton,
  Input,
  Row,
} from "./common";

const DAY_MS = 86400000;
const RECENT_DAYS = 14;

/** Number of consecutive days with a check-in, ending today or yesterday. */
export function streak(dates: string[], today: string) {
  const days = new Set(dates);
  let cursor = new Date(`${today}T00:00:00`);
  if (!days.has(today)) {
    cursor = new Date(cursor.valueOf() - DAY_MS);
  }
  let count = 0;
  while (days.has(localDate(cursor))) {
    count++;
    cursor = new Date(cursor.valueOf() - DAY_MS);
  }
  return count;
}

export default function Checkin({
  data,
  editable,
  update,
  userId,
}: BlockProps<CheckinData>) {
  const { t } = useTranslation();
  const [note, setNote] = React.useState("");
  const today = localDate();
  // Readers without an account see the totals of everyone.
  const entries = userId
    ? data.entries.filter((entry) => entry.userId === userId)
    : data.entries;
  const done = entries.some((entry) => entry.date === today);
  const people = new Set(
    data.entries
      .filter((entry) => entry.date === today)
      .map((entry) => entry.userId)
  ).size;
  const recent = [...entries]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, RECENT_DAYS);

  const checkin = () => {
    if (!userId) {
      return;
    }
    update((value) =>
      value.entries.some(
        (entry) => entry.userId === userId && entry.date === today
      )
        ? value
        : {
            ...value,
            entries: [
              ...value.entries,
              { id: blockId(), userId, date: today, note: note.trim() },
            ],
          }
    );
    setNote("");
  };

  return (
    <>
      <BlockTitle
        value={data.title}
        placeholder={t("Check-in")}
        editable={editable}
        onCommit={(title) => update((value) => ({ ...value, title }))}
      />
      <Stats>
        <span>
          <strong>{entries.length}</strong>
          {t("Total check-ins")}
        </span>
        <span>
          <strong>
            {streak(
              entries.map((entry) => entry.date),
              today
            )}
          </strong>
          {t("Day streak")}
        </span>
        <span>
          <strong>{people}</strong>
          {t("Checked in today")}
        </span>
      </Stats>
      {editable && userId && (
        <Row>
          <Input
            value={note}
            disabled={done}
            placeholder={t("What did you do today?")}
            aria-label={t("Note")}
            onChange={(event) => setNote(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.nativeEvent.isComposing) {
                event.preventDefault();
                checkin();
              }
            }}
          />
          <Button type="button" $primary disabled={done} onClick={checkin}>
            <DoneIcon size={18} />
            {done ? t("Checked in") : t("Check in")}
          </Button>
        </Row>
      )}
      {recent.length ? (
        <List>
          {recent.map((entry) => (
            <li key={entry.id}>
              <EntryDate>{entry.date}</EntryDate>
              <EntryNote>{entry.note || t("Checked in")}</EntryNote>
              {editable && (
                <IconButton
                  type="button"
                  title={t("Delete")}
                  aria-label={t("Delete")}
                  onClick={() =>
                    update((value) => ({
                      ...value,
                      entries: value.entries.filter(
                        (item) => item.id !== entry.id
                      ),
                    }))
                  }
                >
                  <CloseIcon size={18} />
                </IconButton>
              )}
            </li>
          ))}
        </List>
      ) : (
        <Empty>{t("No check-ins yet")}</Empty>
      )}
    </>
  );
}

const Stats = styled.div`
  display: flex;
  gap: 24px;

  span {
    display: flex;
    flex-direction: column;
    color: ${s("textTertiary")};
    font-size: 12px;
  }

  strong {
    color: ${s("text")};
    font-size: 20px;
  }
`;

const List = styled.ul`
  margin: 8px 0 0;
  padding: 0;
  list-style: none;

  li {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 4px 0;
    border-top: 1px solid ${s("divider")};
  }
`;

const EntryDate = styled.span`
  flex-shrink: 0;
  color: ${s("textTertiary")};
  font-size: 13px;
`;

const EntryNote = styled.span`
  flex: 1;
  min-width: 0;
  word-break: break-word;
`;
