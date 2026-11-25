import { CopyIcon, ExpandedIcon } from "outline-icons";
import { Node as ProseMirrorNode } from "prosemirror-model";
import { EditorState } from "prosemirror-state";
import * as React from "react";
import {
  getFrequentCodeLanguages,
  codeLanguages,
  getLabelForLanguage,
} from "@shared/editor/lib/code";
import { MenuItem } from "@shared/editor/types";
import { Dictionary } from "~/hooks/useDictionary";

export default function codeMenuItems(
  state: EditorState,
  readOnly: boolean | undefined,
  dictionary: Dictionary
): MenuItem[] {
  const node = state.selection.$from.node();

  const frequentLanguages = getFrequentCodeLanguages();

  const frequentLangMenuItems = frequentLanguages.map((value) => {
    const label = codeLanguages[value]?.label;
    return langToMenuItem({ node, value, label });
  });

  const remainingLangMenuItems = Object.entries(codeLanguages)
    .filter(
      ([value]) =>
        !frequentLanguages.includes(value as keyof typeof codeLanguages)
    )
    .map(([value, item]) => langToMenuItem({ node, value, label: item.label }));

  const languageMenuItems = frequentLangMenuItems.length
    ? [
        ...frequentLangMenuItems,
        { name: "separator" },
        ...remainingLangMenuItems,
      ]
    : remainingLangMenuItems;

  return [
    {
      name: "copyToClipboard",
      icon: <CopyIcon />,
      label: readOnly ? dictionary.copy : undefined,
      tooltip: dictionary.copy,
    },
    {
      name: "toggleCodeFullscreen",
      icon: <FullscreenIcon />,
      tooltip: dictionary.fullscreen,
    },
    {
      name: "separator",
      visible: !readOnly,
    },
    {
      visible: !readOnly,
      name: "code_block",
      icon: <ExpandedIcon />,
      label: getLabelForLanguage(node.attrs.language ?? "none"),
      children: languageMenuItems,
    },
  ];
}

const FullscreenIcon = () => (
  <svg width={24} height={24} viewBox="0 0 24 24" fill="currentColor">
    <path d="M6 6h4v2H8v2H6V6zm8 0h4v4h-2V8h-2V6zM6 14h2v2h2v2H6v-4zm10 0h2v4h-4v-2h2v-2z" />
  </svg>
);

const langToMenuItem = ({
  node,
  value,
  label,
}: {
  node: ProseMirrorNode;
  value: string;
  label: string;
}): MenuItem => ({
  name: "code_block",
  label,
  active: () => node.attrs.language === value,
  attrs: {
    language: value,
  },
});
