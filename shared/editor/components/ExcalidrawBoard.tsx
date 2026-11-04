import { EditIcon, ShapesIcon } from "outline-icons";
import * as React from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import styled, { useTheme } from "styled-components";
import { s } from "../../styles";
import { svgToDataUrl } from "../lib/excalidraw";
import { ComponentProps } from "../types";

const ExcalidrawEditor = React.lazy(() => import("./ExcalidrawEditor"));

type Props = ComponentProps & {
  /** Called with the serialized scene and its SVG preview. */
  onSave: (data: string, svg: string) => void;
};

/**
 * Renders the preview of a drawing and opens the full screen editor.
 */
export default function ExcalidrawBoard(props: Props) {
  const { node, isEditable, isSelected, onSave } = props;
  const theme = useTheme();
  const { data, svg } = node.attrs as { data: string; svg: string };
  const { t } = useTranslation();
  const [open, setOpen] = React.useState(false);
  const [renderedSvg, setRenderedSvg] = React.useState("");
  const preview = svg || renderedSvg;

  // An empty drawing, such as one just inserted from the menu, opens the
  // editor as soon as it is selected.
  const autoOpened = React.useRef(false);
  React.useEffect(() => {
    if (isEditable && isSelected && !data && !autoOpened.current) {
      autoOpened.current = true;
      setOpen(true);
    }
  }, [isEditable, isSelected, data]);

  // Drawings imported from Markdown have no stored preview yet.
  React.useEffect(() => {
    if (svg || !data) {
      return;
    }
    let cancelled = false;
    void import("./ExcalidrawEditor")
      .then((module) => module.renderSvg(data))
      .then((result) => {
        if (!cancelled) {
          setRenderedSvg(result);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [data, svg]);

  const handleOpen = React.useCallback(
    (event: React.SyntheticEvent) => {
      if (!isEditable) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      setOpen(true);
    },
    [isEditable]
  );

  const handleSave = React.useCallback(
    (nextData: string, nextSvg: string) => {
      onSave(nextData, nextSvg);
      setOpen(false);
    },
    [onSave]
  );

  return (
    <Wrapper
      className="excalidraw-board"
      contentEditable={false}
      $selected={isSelected}
      $editable={isEditable}
      onDoubleClick={handleOpen}
    >
      {preview ? (
        <Preview src={svgToDataUrl(preview)} alt={t("Drawing")} />
      ) : (
        <Empty>
          <ShapesIcon />
          {isEditable ? t("Empty drawing, click edit to start") : t("Drawing")}
        </Empty>
      )}
      {isEditable && (
        <EditButton type="button" onClick={handleOpen}>
          <EditIcon size={18} />
          {t("Edit drawing")}
        </EditButton>
      )}
      {open &&
        createPortal(
          <React.Suspense fallback={<Loading>{t("Loading")}…</Loading>}>
            <ExcalidrawEditor
              data={data}
              isDark={!!theme?.isDark}
              onSave={handleSave}
              onClose={() => setOpen(false)}
            />
          </React.Suspense>,
          document.body
        )}
    </Wrapper>
  );
}

const Wrapper = styled.div<{ $selected: boolean; $editable: boolean }>`
  position: relative;
  margin: 0.75em 0;
  min-height: 80px;
  border-radius: 6px;
  border: 1px solid
    ${(props) => (props.$selected ? props.theme.accent : props.theme.divider)};
  background: ${s("background")};
  overflow: hidden;
  cursor: ${(props) => (props.$editable ? "pointer" : "default")};
  user-select: none;

  &:hover button {
    opacity: 1;
  }
`;

const Preview = styled.img`
  display: block;
  max-width: 100%;
  max-height: 640px;
  margin: 0 auto;
`;

const Empty = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 120px;
  color: ${s("textTertiary")};
`;

const EditButton = styled.button`
  position: absolute;
  top: 8px;
  right: 8px;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border: 1px solid ${s("divider")};
  border-radius: 4px;
  background: ${s("background")};
  color: ${s("text")};
  font-size: 13px;
  cursor: pointer;
  opacity: 0;
  transition: opacity 100ms ease-in-out;

  @media (hover: none) {
    opacity: 1;
  }
`;

const Loading = styled.div`
  position: fixed;
  inset: 0;
  z-index: 3000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${s("background")};
  color: ${s("textSecondary")};
`;
