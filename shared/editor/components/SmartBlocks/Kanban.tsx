import { CloseIcon, PlusIcon } from "outline-icons";
import * as React from "react";
import { useTranslation } from "react-i18next";
import styled from "styled-components";
import { s } from "../../../styles";
import { BLOCK_DRAG_TYPE, KanbanData, blockId } from "../../lib/smartBlocks";
import {
  BlockProps,
  BlockTitle,
  IconButton,
  Input,
  Row,
  TextField,
} from "./common";

const DRAG_TYPE = `${BLOCK_DRAG_TYPE}-kanban`;

export default function Kanban({
  data,
  editable,
  update,
}: BlockProps<KanbanData>) {
  const { t } = useTranslation();
  const [dragOver, setDragOver] = React.useState<string>();

  const moveTask = (taskId: string, columnId: string, beforeId?: string) =>
    update((current) => {
      const task = current.tasks.find((item) => item.id === taskId);
      if (!task || taskId === beforeId) {
        return current;
      }
      const tasks = current.tasks.filter((item) => item.id !== taskId);
      const moved = { ...task, columnId };
      const index = beforeId
        ? tasks.findIndex((item) => item.id === beforeId)
        : -1;
      if (index >= 0) {
        tasks.splice(index, 0, moved);
      } else {
        tasks.push(moved);
      }
      return { ...current, tasks };
    });

  const handleDrop =
    (columnId: string, beforeId?: string) => (event: React.DragEvent) => {
      const taskId = event.dataTransfer.getData(DRAG_TYPE);
      setDragOver(undefined);
      if (!taskId) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      moveTask(taskId, columnId, beforeId);
    };

  const allowDrop = (columnId: string) => (event: React.DragEvent) => {
    if (editable && event.dataTransfer.types.includes(DRAG_TYPE)) {
      event.preventDefault();
      setDragOver(columnId);
    }
  };

  return (
    <>
      <BlockTitle
        value={data.title}
        placeholder={t("Kanban")}
        editable={editable}
        onCommit={(title) => update((current) => ({ ...current, title }))}
      />
      <Board>
        {data.columns.map((column) => {
          const tasks = data.tasks.filter(
            (task) => task.columnId === column.id
          );
          return (
            <Column
              key={column.id}
              $over={dragOver === column.id}
              onDragOver={allowDrop(column.id)}
              onDragLeave={() => setDragOver(undefined)}
              onDrop={handleDrop(column.id)}
            >
              <ColumnHeader>
                {editable ? (
                  <ColumnTitle
                    value={column.title}
                    aria-label={t("Column name")}
                    onCommit={(title) =>
                      update((current) => ({
                        ...current,
                        columns: current.columns.map((item) =>
                          item.id === column.id ? { ...item, title } : item
                        ),
                      }))
                    }
                  />
                ) : (
                  <strong>{column.title}</strong>
                )}
                <Count>{tasks.length}</Count>
                {editable && (
                  <IconButton
                    type="button"
                    title={t("Delete column")}
                    aria-label={t("Delete column")}
                    onClick={() => {
                      if (
                        tasks.length &&
                        !window.confirm(t("Delete this column and its cards?"))
                      ) {
                        return;
                      }
                      update((current) => ({
                        ...current,
                        columns: current.columns.filter(
                          (item) => item.id !== column.id
                        ),
                        tasks: current.tasks.filter(
                          (task) => task.columnId !== column.id
                        ),
                      }));
                    }}
                  >
                    <CloseIcon size={18} />
                  </IconButton>
                )}
              </ColumnHeader>
              {tasks.map((task) => (
                <Card
                  key={task.id}
                  taskId={task.id}
                  editable={editable}
                  onDragOver={allowDrop(column.id)}
                  onDrop={handleDrop(column.id, task.id)}
                >
                  {editable ? (
                    <>
                      <TextField
                        multiline
                        value={task.text}
                        aria-label={t("Card")}
                        onCommit={(text) =>
                          update((current) => ({
                            ...current,
                            tasks: current.tasks.map((item) =>
                              item.id === task.id ? { ...item, text } : item
                            ),
                          }))
                        }
                      />
                      <IconButton
                        type="button"
                        title={t("Delete card")}
                        aria-label={t("Delete card")}
                        onClick={() =>
                          update((current) => ({
                            ...current,
                            tasks: current.tasks.filter(
                              (item) => item.id !== task.id
                            ),
                          }))
                        }
                      >
                        <CloseIcon size={18} />
                      </IconButton>
                    </>
                  ) : (
                    <CardText>{task.text}</CardText>
                  )}
                </Card>
              ))}
              {editable && (
                <AddCard
                  onAdd={(text) =>
                    update((current) => ({
                      ...current,
                      tasks: [
                        ...current.tasks,
                        { id: blockId(), columnId: column.id, text },
                      ],
                    }))
                  }
                />
              )}
            </Column>
          );
        })}
        {editable && (
          <AddColumn
            onAdd={(title) =>
              update((current) => ({
                ...current,
                columns: [...current.columns, { id: blockId(), title }],
              }))
            }
          />
        )}
      </Board>
    </>
  );
}

function AddCard({ onAdd }: { onAdd: (text: string) => void }) {
  const { t } = useTranslation();
  return <AddInput placeholder={t("Add a card")} onAdd={onAdd} />;
}

function AddColumn({ onAdd }: { onAdd: (title: string) => void }) {
  const { t } = useTranslation();
  return (
    <NewColumn>
      <AddInput placeholder={t("Add a column")} onAdd={onAdd} />
    </NewColumn>
  );
}

/** An input that adds an item when pressing enter or clicking plus. */
export function AddInput({
  placeholder,
  onAdd,
}: {
  placeholder: string;
  onAdd: (value: string) => void;
}) {
  const [value, setValue] = React.useState("");
  const add = () => {
    if (value.trim()) {
      onAdd(value.trim());
      setValue("");
    }
  };
  return (
    <Row>
      <Input
        value={value}
        placeholder={placeholder}
        aria-label={placeholder}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.nativeEvent.isComposing) {
            event.preventDefault();
            add();
          }
        }}
      />
      <IconButton
        type="button"
        title={placeholder}
        aria-label={placeholder}
        onClick={add}
      >
        <PlusIcon size={18} />
      </IconButton>
    </Row>
  );
}

const Board = styled.div`
  display: flex;
  gap: 8px;
  overflow-x: auto;
  align-items: flex-start;
  padding-bottom: 4px;
`;

const Column = styled.div<{ $over: boolean }>`
  flex: 1 0 160px;
  min-width: 0;
  padding: 8px;
  border-radius: 6px;
  background: ${s("backgroundSecondary")};
  outline: 2px solid
    ${(props) => (props.$over ? props.theme.accent : "transparent")};
`;

const NewColumn = styled.div`
  flex: 0 0 160px;
`;

const ColumnHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 8px;

  > strong {
    flex: 1;
    padding: 4px 0;
  }
`;

const ColumnTitle = styled(TextField)`
  flex: 1;
  font-weight: 600;
  border-color: transparent;
  background: transparent;
`;

const Count = styled.span`
  color: ${s("textTertiary")};
  font-size: 12px;
`;

/**
 * A card that is dragged by its handle, dragging the whole card would prevent
 * selecting text in its input.
 */
function Card({
  taskId,
  editable,
  children,
  ...rest
}: React.HTMLAttributes<HTMLDivElement> & {
  taskId: string;
  editable: boolean;
}) {
  const { t } = useTranslation();
  const ref = React.useRef<HTMLDivElement>(null);
  return (
    <CardWrapper {...rest} ref={ref}>
      {editable && (
        <Handle
          draggable
          title={t("Drag to move")}
          onDragStart={(event) => {
            event.stopPropagation();
            event.dataTransfer.setData(DRAG_TYPE, taskId);
            event.dataTransfer.effectAllowed = "move";
            if (ref.current) {
              event.dataTransfer.setDragImage(ref.current, 8, 8);
            }
          }}
        >
          ⋮⋮
        </Handle>
      )}
      {children}
    </CardWrapper>
  );
}

const Handle = styled.span`
  flex-shrink: 0;
  padding: 2px 0;
  color: ${s("textTertiary")};
  font-size: 12px;
  letter-spacing: -2px;
  cursor: grab;
  user-select: none;
`;

const CardWrapper = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 4px;
  margin-bottom: 6px;
  padding: 6px;
  border-radius: 4px;
  background: ${s("background")};
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.12);

  textarea {
    border-color: transparent;
    padding: 2px 4px;
  }
`;

const CardText = styled.div`
  white-space: pre-wrap;
  word-break: break-word;
`;
