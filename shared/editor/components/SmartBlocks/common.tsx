import * as React from "react";
import styled from "styled-components";
import { s } from "../../../styles";

export type BlockProps<T> = {
  data: T;
  /** Whether the document can be edited by the current user. */
  editable: boolean;
  /** Apply a change to the latest stored data of the block. */
  update: (change: (data: T) => T) => void;
  userId?: string;
  uploadFile?: (file: File) => Promise<string>;
};

const COMMIT_DELAY = 400;

type FieldProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "value" | "onChange"
> & {
  value: string;
  onCommit: (value: string) => void;
  multiline?: boolean;
};

/**
 * A text input that keeps its own state while typing and writes to the
 * document after a short pause, so that every keystroke does not round trip
 * through the editor and the cursor never jumps.
 */
export function TextField({
  value,
  onCommit,
  multiline,
  onBlur,
  ...rest
}: FieldProps) {
  const [draft, setDraft] = React.useState(value);
  const focused = React.useRef(false);
  const timer = React.useRef<ReturnType<typeof setTimeout>>();
  const latest = React.useRef({ draft, value, onCommit });
  latest.current = { draft, value, onCommit };

  React.useEffect(() => {
    if (!focused.current) {
      setDraft(value);
    }
  }, [value]);

  const commit = React.useCallback(() => {
    clearTimeout(timer.current);
    const current = latest.current;
    if (current.draft !== current.value) {
      current.onCommit(current.draft);
    }
  }, []);

  React.useEffect(() => () => commit(), [commit]);

  const handleChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setDraft(event.target.value);
    clearTimeout(timer.current);
    timer.current = setTimeout(commit, COMMIT_DELAY);
  };

  const props = {
    ...rest,
    value: draft,
    onChange: handleChange,
    onFocus: () => {
      focused.current = true;
    },
    onBlur: (event: React.FocusEvent<HTMLInputElement>) => {
      focused.current = false;
      commit();
      onBlur?.(event);
    },
  };

  return multiline ? (
    <TextArea
      {...(props as unknown as React.TextareaHTMLAttributes<HTMLTextAreaElement>)}
      rows={2}
    />
  ) : (
    <Input {...props} />
  );
}

/** The editable or static title of a block. */
export function BlockTitle({
  value,
  placeholder,
  editable,
  onCommit,
}: {
  value: string;
  placeholder: string;
  editable: boolean;
  onCommit: (value: string) => void;
}) {
  if (editable) {
    return (
      <TitleInput
        value={value}
        placeholder={placeholder}
        aria-label={placeholder}
        onCommit={onCommit}
      />
    );
  }
  return value ? <Title>{value}</Title> : null;
}

export const Wrapper = styled.div<{ $selected?: boolean }>`
  margin: 0.75em 0;
  padding: 12px;
  border-radius: 8px;
  border: 1px solid
    ${(props) => (props.$selected ? props.theme.accent : props.theme.divider)};
  background: ${s("background")};
  color: ${s("text")};
  font-size: 14px;
  line-height: 1.5;
  user-select: text;
  white-space: normal;

  p {
    margin: 0;
  }
`;

export const Input = styled.input`
  box-sizing: border-box;
  min-width: 0;
  padding: 4px 8px;
  border: 1px solid ${s("inputBorder")};
  border-radius: 4px;
  background: ${s("background")};
  color: ${s("text")};
  font: inherit;
  outline: none;

  &:focus {
    border-color: ${s("inputBorderFocused")};
  }
`;

const TextArea = styled.textarea`
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  padding: 4px 8px;
  border: 1px solid ${s("inputBorder")};
  border-radius: 4px;
  background: ${s("background")};
  color: ${s("text")};
  font: inherit;
  resize: vertical;
  outline: none;

  &:focus {
    border-color: ${s("inputBorderFocused")};
  }
`;

const TitleInput = styled(TextField)`
  display: block;
  width: 100%;
  margin-bottom: 8px;
  border-color: transparent;
  font-size: 16px;
  font-weight: 600;

  &:hover {
    border-color: ${s("inputBorder")};
  }
`;

export const Title = styled.div`
  margin-bottom: 8px;
  font-size: 16px;
  font-weight: 600;
`;

export const Row = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-top: 8px;

  > input {
    flex: 1;
  }
`;

export const Button = styled.button<{ $primary?: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border: 1px solid
    ${(props) =>
      props.$primary ? props.theme.accent : props.theme.buttonNeutralBorder};
  border-radius: 4px;
  background: ${(props) =>
    props.$primary ? props.theme.accent : props.theme.buttonNeutralBackground};
  color: ${(props) =>
    props.$primary ? props.theme.accentText : props.theme.buttonNeutralText};
  font: inherit;
  white-space: nowrap;
  cursor: pointer;

  &:disabled {
    opacity: 0.5;
    cursor: default;
  }
`;

export const IconButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  padding: 0;
  border: 0;
  border-radius: 4px;
  background: none;
  color: ${s("textTertiary")};
  cursor: pointer;

  &:hover:not(:disabled) {
    color: ${s("text")};
    background: ${s("backgroundSecondary")};
  }

  &:disabled {
    opacity: 0.4;
    cursor: default;
  }
`;

export const Empty = styled.p`
  margin: 8px 0 0;
  color: ${s("textTertiary")};
`;

export const ErrorText = styled.p`
  margin: 8px 0 0;
  color: ${s("danger")};
`;

export const Hint = styled.div`
  color: ${s("textTertiary")};
  font-size: 13px;
`;
