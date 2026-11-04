import { Excalidraw, exportToSvg, restore } from "@excalidraw/excalidraw";
// eslint-disable-next-line import/no-unresolved
import "@excalidraw/excalidraw/index.css";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import styled from "styled-components";
import { MAX_DRAWING_SIZE } from "../lib/excalidraw";

declare global {
  interface Window {
    EXCALIDRAW_ASSET_PATH?: string | string[];
  }
}

// Fonts are served by Outline instead of a public CDN.
window.EXCALIDRAW_ASSET_PATH = `${window.location.origin}/fonts/excalidraw/`;

type ExcalidrawApi = {
  getSceneElements: () => readonly { isDeleted?: boolean }[];
  getAppState: () => Record<string, unknown>;
  getFiles: () => Record<string, unknown>;
};

type Props = {
  /** The stored scene JSON, empty for a new drawing. */
  data: string;
  isDark: boolean;
  onSave: (data: string, svg: string) => void;
  onClose: () => void;
};

type Scene = {
  elements: readonly { isDeleted?: boolean }[];
  appState: Record<string, unknown>;
  files: Record<string, unknown>;
};

function parseScene(data: string): Scene {
  const empty: Scene = { elements: [], appState: {}, files: {} };
  if (!data) {
    return empty;
  }
  try {
    return restore(JSON.parse(data), null, null) as unknown as Scene;
  } catch (_err) {
    return empty;
  }
}

async function toSvg(
  elements: readonly unknown[],
  appState: Record<string, unknown>,
  files: Record<string, unknown>
) {
  if (!elements.length) {
    return "";
  }
  const svg = await exportToSvg({
    elements: elements as never,
    appState: {
      ...appState,
      exportBackground: true,
      exportWithDarkMode: false,
    } as never,
    files: files as never,
    exportPadding: 16,
  });
  return svg.outerHTML;
}

/**
 * Render the SVG preview for a stored scene.
 *
 * @param data The stored scene JSON.
 * @returns SVG markup, or an empty string for an empty drawing.
 */
export async function renderSvg(data: string) {
  const scene = parseScene(data);
  return toSvg(
    scene.elements.filter((element) => !element.isDeleted),
    scene.appState,
    scene.files
  );
}

/**
 * Full screen Excalidraw editor. Loaded lazily so the drawing library is only
 * downloaded when a drawing is opened for editing.
 */
export default function ExcalidrawEditor({
  data,
  isDark,
  onSave,
  onClose,
}: Props) {
  const { t, i18n } = useTranslation();
  const api = React.useRef<ExcalidrawApi | null>(null);
  const [saving, setSaving] = React.useState(false);
  const initialData = React.useMemo(() => {
    const scene = parseScene(data);
    return { ...scene, scrollToContent: true };
  }, [data]);

  const handleSave = React.useCallback(async () => {
    if (!api.current) {
      return;
    }
    setSaving(true);
    try {
      const elements = api.current
        .getSceneElements()
        .filter((element) => !element.isDeleted);
      const appState = api.current.getAppState();
      const files = api.current.getFiles();
      const scene = JSON.stringify({
        type: "excalidraw",
        version: 2,
        source: "outline",
        elements,
        appState: {
          viewBackgroundColor: appState.viewBackgroundColor,
          gridSize: appState.gridSize ?? null,
        },
        files,
      });
      const svg = await toSvg(elements, appState, files);

      if (scene.length + svg.length > MAX_DRAWING_SIZE) {
        toast.error(t("The drawing is too large to save"));
        return;
      }
      onSave(elements.length ? scene : "", svg);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }, [onSave, t]);

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "s") {
        event.preventDefault();
        void handleSave();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleSave]);

  // Keep key presses inside the drawing editor away from the document.
  const stopPropagation = React.useCallback(
    (event: React.KeyboardEvent) => event.stopPropagation(),
    []
  );

  return (
    <Overlay
      role="dialog"
      aria-label={t("Edit drawing")}
      onKeyDown={stopPropagation}
    >
      <Toolbar>
        <Title>{t("Edit drawing")}</Title>
        <Actions>
          <ToolbarButton type="button" onClick={onClose}>
            {t("Cancel")}
          </ToolbarButton>
          <ToolbarButton
            type="button"
            $primary
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? `${t("Saving")}…` : t("Save")}
          </ToolbarButton>
        </Actions>
      </Toolbar>
      <Canvas>
        <Excalidraw
          initialData={initialData as never}
          excalidrawAPI={(instance) => {
            api.current = instance as unknown as ExcalidrawApi;
          }}
          autoFocus
          theme={isDark ? "dark" : "light"}
          langCode={i18n.language?.startsWith("zh") ? "zh-CN" : "en"}
          UIOptions={{
            canvasActions: {
              loadScene: false,
              saveToActiveFile: false,
              export: { saveFileToDisk: true },
            },
          }}
        />
      </Canvas>
    </Overlay>
  );
}

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 3000;
  display: flex;
  flex-direction: column;
  background: ${(props) => props.theme.background};
`;

const Toolbar = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 16px;
  border-bottom: 1px solid ${(props) => props.theme.divider};
`;

const Title = styled.div`
  font-weight: 600;
  color: ${(props) => props.theme.text};
`;

const Actions = styled.div`
  display: flex;
  gap: 8px;
`;

const ToolbarButton = styled.button<{ $primary?: boolean }>`
  padding: 6px 14px;
  border-radius: 4px;
  border: 1px solid
    ${(props) => (props.$primary ? props.theme.accent : props.theme.divider)};
  background: ${(props) =>
    props.$primary ? props.theme.accent : props.theme.background};
  color: ${(props) =>
    props.$primary ? props.theme.accentText : props.theme.text};
  font-size: 14px;
  cursor: pointer;

  &:disabled {
    opacity: 0.6;
    cursor: default;
  }
`;

const Canvas = styled.div`
  flex: 1;
  min-height: 0;
`;
