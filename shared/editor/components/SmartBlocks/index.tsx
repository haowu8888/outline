import * as React from "react";
import { useTranslation } from "react-i18next";
import {
  SmartBlockData,
  SmartBlockKind,
  isSmartBlockKind,
  parseBlockData,
} from "../../lib/smartBlocks";
import { ComponentProps } from "../../types";
import Calendar from "./Calendar";
import Checkin from "./Checkin";
import Encrypted from "./Encrypted";
import Gallery from "./Gallery";
import Kanban from "./Kanban";
import Poll from "./Poll";
import { BlockProps, ErrorText, Wrapper } from "./common";

type Props = ComponentProps & {
  userId?: string;
  uploadFile?: (file: File) => Promise<string>;
  /** Write new data computed from the latest stored JSON. */
  onSave: (update: (current: string) => unknown) => void;
};

const VIEWS: {
  [K in SmartBlockKind]: React.ComponentType<BlockProps<SmartBlockData[K]>>;
} = {
  kanban: Kanban,
  gallery: Gallery,
  calendar: Calendar,
  poll: Poll,
  checkin: Checkin,
  encrypted: Encrypted,
};

/**
 * Renders an interactive block, see lib/smartBlocks for the stored data.
 */
export default function SmartBlockView({
  node,
  isEditable,
  isSelected,
  userId,
  uploadFile,
  onSave,
}: Props) {
  const { t } = useTranslation();
  const { kind, data: json } = node.attrs as { kind: string; data: string };
  const [error, setError] = React.useState("");
  const data = React.useMemo(
    () => (isSmartBlockKind(kind) ? parseBlockData(kind, json) : undefined),
    [kind, json]
  );

  const update = React.useCallback(
    (change: (value: never) => unknown) => {
      if (!isSmartBlockKind(kind)) {
        return;
      }
      try {
        onSave((current) => change(parseBlockData(kind, current) as never));
        setError("");
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    },
    [kind, onSave]
  );

  if (!isSmartBlockKind(kind) || !data) {
    return (
      <Wrapper contentEditable={false}>
        <ErrorText>{t("Unsupported block")}</ErrorText>
      </Wrapper>
    );
  }

  const View = VIEWS[kind] as React.ComponentType<BlockProps<typeof data>>;
  return (
    <Wrapper
      className={`smart-block smart-block-${kind}`}
      contentEditable={false}
      $selected={isSelected}
      // Let inputs and drag and drop inside the block handle their own events.
      data-pm-stop-event
    >
      <View
        data={data}
        editable={isEditable}
        update={update}
        userId={userId}
        uploadFile={uploadFile}
      />
      {error && <ErrorText>{error}</ErrorText>}
    </Wrapper>
  );
}
