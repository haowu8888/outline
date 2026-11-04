import { BackIcon, CloseIcon, NextIcon } from "outline-icons";
import * as React from "react";
import { useTranslation } from "react-i18next";
import styled from "styled-components";
import { s } from "../../../styles";
import { CalendarData, blockId, localDate } from "../../lib/smartBlocks";
import { AddInput } from "./Kanban";
import { BlockProps, BlockTitle, Empty, Hint, IconButton, Row } from "./common";

const DAYS_IN_WEEK = 7;
const MAX_EVENTS_IN_CELL = 2;

function shiftMonth(month: string, step: number) {
  const [year, value] = month.split("-").map(Number);
  return localDate(new Date(year, value - 1 + step, 1)).slice(0, 7);
}

/** Dates of the month padded to whole weeks starting on Monday. */
function monthCells(month: string) {
  const [year, value] = month.split("-").map(Number);
  const leading = (new Date(year, value - 1, 1).getDay() + 6) % DAYS_IN_WEEK;
  const days = new Date(year, value, 0).getDate();
  const cells: (string | null)[] = Array.from({ length: leading }, () => null);
  for (let day = 1; day <= days; day++) {
    cells.push(`${month}-${String(day).padStart(2, "0")}`);
  }
  while (cells.length % DAYS_IN_WEEK) {
    cells.push(null);
  }
  return cells;
}

export default function Calendar({
  data,
  editable,
  update,
}: BlockProps<CalendarData>) {
  const { t } = useTranslation();
  const today = localDate();
  // Browsing months is local, it should not change the document.
  const [month, setMonth] = React.useState(data.month);
  const [selected, setSelected] = React.useState(() =>
    today.startsWith(data.month) ? today : `${data.month}-01`
  );
  React.useEffect(() => setMonth(data.month), [data.month]);

  const weekdays = [
    t("Mon"),
    t("Tue"),
    t("Wed"),
    t("Thu"),
    t("Fri"),
    t("Sat"),
    t("Sun"),
  ];

  const move = (step: number) => {
    const next = shiftMonth(month, step);
    setMonth(next);
    setSelected(today.startsWith(next) ? today : `${next}-01`);
  };

  const events = data.events.filter((event) => event.date === selected);

  return (
    <>
      <BlockTitle
        value={data.title}
        placeholder={t("Calendar")}
        editable={editable}
        onCommit={(title) => update((value) => ({ ...value, title }))}
      />
      <Row>
        <IconButton
          type="button"
          aria-label={t("Previous month")}
          onClick={() => move(-1)}
        >
          <BackIcon />
        </IconButton>
        <strong>{month}</strong>
        <IconButton
          type="button"
          aria-label={t("Next month")}
          onClick={() => move(1)}
        >
          <NextIcon />
        </IconButton>
      </Row>
      <Grid role="grid">
        {weekdays.map((day) => (
          <Weekday key={day}>{day}</Weekday>
        ))}
        {monthCells(month).map((cell, index) =>
          cell ? (
            <Day
              key={cell}
              type="button"
              aria-selected={cell === selected}
              $today={cell === today}
              $selected={cell === selected}
              onClick={() => setSelected(cell)}
            >
              <span>{Number(cell.slice(-2))}</span>
              {data.events
                .filter((event) => event.date === cell)
                .slice(0, MAX_EVENTS_IN_CELL)
                .map((event) => (
                  <small key={event.id}>{event.title}</small>
                ))}
            </Day>
          ) : (
            <span key={`blank-${index}`} />
          )
        )}
      </Grid>
      <Agenda>
        <Hint>{selected}</Hint>
        {events.length ? (
          events.map((event) => (
            <Row key={event.id}>
              <span>{event.title}</span>
              {editable && (
                <IconButton
                  type="button"
                  title={t("Delete event")}
                  aria-label={t("Delete event")}
                  onClick={() =>
                    update((value) => ({
                      ...value,
                      events: value.events.filter(
                        (item) => item.id !== event.id
                      ),
                    }))
                  }
                >
                  <CloseIcon size={18} />
                </IconButton>
              )}
            </Row>
          ))
        ) : (
          <Empty>{t("No events on this day")}</Empty>
        )}
        {editable && (
          <AddInput
            placeholder={t("Add an event")}
            onAdd={(title) =>
              update((value) => ({
                ...value,
                events: [
                  ...value.events,
                  { id: blockId(), date: selected, title },
                ],
              }))
            }
          />
        )}
      </Agenda>
    </>
  );
}

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 2px;
  margin-top: 8px;
`;

const Weekday = styled.span`
  padding: 2px 0;
  color: ${s("textTertiary")};
  font-size: 12px;
  text-align: center;
`;

const Day = styled.button<{ $today: boolean; $selected: boolean }>`
  display: flex;
  flex-direction: column;
  align-items: stretch;
  min-height: 56px;
  padding: 2px 4px;
  border: 1px solid
    ${(props) => (props.$selected ? props.theme.accent : props.theme.divider)};
  border-radius: 4px;
  background: ${(props) =>
    props.$today ? props.theme.backgroundSecondary : props.theme.background};
  color: ${s("text")};
  font: inherit;
  text-align: left;
  cursor: pointer;
  overflow: hidden;

  span {
    font-size: 12px;
    font-weight: ${(props) => (props.$today ? 700 : 400)};
  }

  small {
    overflow: hidden;
    padding: 0 2px;
    border-radius: 2px;
    background: ${s("mentionBackground")};
    font-size: 11px;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  small + small {
    margin-top: 1px;
  }
`;

const Agenda = styled.div`
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid ${s("divider")};

  > div > span {
    flex: 1;
  }
`;
