'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  BLUR_COMMAND,
  COMMAND_PRIORITY_LOW,
  FOCUS_COMMAND,
  KEY_ENTER_COMMAND,
  KEY_ESCAPE_COMMAND,
} from 'lexical';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { exportWhatsAppText, importWhatsAppText } from '@/lib/messaging/whatsapp-rich-text';
import type { RichTextVariableOption } from '@/components/rich-text-input';
import { useEditor } from './context';
import { cn } from '@/lib/cn';

interface InlineRichTextProps {
  blockId: string;
  propName: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  showFontSize?: boolean;
  variables?: RichTextVariableOption[];
  singleLine?: boolean;
  className?: string;
  inputRef?: React.Ref<HTMLDivElement>;
}

function ValueSyncPlugin({ value }: { value: string }) {
  const [lexicalEditor] = useLexicalComposerContext();

  useEffect(() => {
    const currentValue = lexicalEditor.getEditorState().read(exportWhatsAppText);
    if (currentValue !== value) {
      lexicalEditor.update(() => importWhatsAppText(value));
    }
  }, [lexicalEditor, value]);

  return null;
}

function ActiveSyncPlugin({
  blockId,
  propName,
  showFontSize,
  variables,
  isFocused,
  setIsFocused,
}: {
  blockId: string;
  propName: string;
  showFontSize?: boolean;
  variables?: RichTextVariableOption[];
  isFocused: boolean;
  setIsFocused: (v: boolean) => void;
}) {
  const [lexicalEditor] = useLexicalComposerContext();
  const editor = useEditor();
  const editorRef = useRef(editor);
  editorRef.current = editor;

  // Sincroniza quando a seleção do bloco muda no contexto do PageBuilder
  useEffect(() => {
    const current = editorRef.current;
    if (!current) return;
    if (current.selectedId === blockId && current.activeRichText?.blockId !== blockId) {
      current.setActiveRichText({
        editor: lexicalEditor,
        blockId,
        propName,
        showFontSize,
        variables,
      });
    }
  }, [editor?.selectedId, editor?.activeRichText?.blockId, blockId, propName, showFontSize, variables, lexicalEditor]);

  // Registra os comandos do Lexical
  useEffect(() => {
    const unregFocus = lexicalEditor.registerCommand(
      FOCUS_COMMAND,
      () => {
        setIsFocused(true);
        if (editorRef.current) {
          editorRef.current.select(blockId);
          editorRef.current.setActiveRichText({
            editor: lexicalEditor,
            blockId,
            propName,
            showFontSize,
            variables,
          });
        }
        return false;
      },
      COMMAND_PRIORITY_LOW,
    );

    const unregBlur = lexicalEditor.registerCommand(
      BLUR_COMMAND,
      () => {
        return false;
      },
      COMMAND_PRIORITY_LOW,
    );

    const unregEsc = lexicalEditor.registerCommand(
      KEY_ESCAPE_COMMAND,
      () => {
        setIsFocused(false);
        lexicalEditor.blur();
        return true;
      },
      COMMAND_PRIORITY_LOW,
    );

    return () => {
      unregFocus();
      unregBlur();
      unregEsc();
    };
  }, [lexicalEditor, blockId, propName, showFontSize, variables, setIsFocused]);

  useEffect(() => {
    if (editor && editor.selectedId !== blockId && isFocused) {
      setIsFocused(false);
    }
  }, [editor?.selectedId, blockId, isFocused, setIsFocused]);

  return null;
}

function SingleLinePlugin({ enabled }: { enabled?: boolean }) {
  const [lexicalEditor] = useLexicalComposerContext();

  useEffect(() => {
    if (!enabled) return;
    return lexicalEditor.registerCommand(
      KEY_ENTER_COMMAND,
      (event) => {
        if (event) event.preventDefault();
        return true;
      },
      COMMAND_PRIORITY_LOW,
    );
  }, [lexicalEditor, enabled]);

  return null;
}

function InlineEditorInner({
  blockId,
  propName,
  value,
  onChange,
  placeholder,
  showFontSize = true,
  variables,
  singleLine = false,
  className,
  inputRef,
}: InlineRichTextProps) {
  const editor = useEditor();
  const isSelected = editor?.selectedId === blockId;
  const [isFocused, setIsFocused] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const isEditorActive = isSelected || isFocused;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    editor?.select(blockId);
    setIsFocused(true);
    const el = containerRef.current?.querySelector('[contenteditable="true"]') as HTMLElement;
    if (el && document.activeElement !== el) {
      el.focus();
    }
  };

  return (
    <div
      ref={containerRef}
      data-testid={`inline-rich-text-${blockId}-${propName}`}
      className={cn(
        'group/inline-rt relative min-w-0 w-full transition-all cursor-text rounded-md',
        !isEditorActive &&
          'hover:ring-1 hover:ring-primary/40 hover:bg-primary/5 px-1 -mx-1',
        isEditorActive &&
          'ring-1 ring-primary/60 bg-background/50 px-1 -mx-1 shadow-xs',
      )}
      onClick={handleClick}
      onPointerDown={(e) => {
        // Previne que dnd-kit intercepte seleção de texto do usuário
        e.stopPropagation();
      }}
    >
      <RichTextPlugin
        contentEditable={
          <ContentEditable
            ref={inputRef}
            aria-label={propName}
            aria-multiline={!singleLine}
            className={cn(
              'outline-none whitespace-pre-wrap break-words min-h-[1.5em] w-full cursor-text text-inherit',
              className,
            )}
          />
        }
        placeholder={
          <div className="pointer-events-none absolute inset-x-0 top-0 text-muted-foreground/60 italic text-sm select-none">
            {placeholder ?? 'Clique para digitar o texto...'}
          </div>
        }
        ErrorBoundary={LexicalErrorBoundary}
      />
      <HistoryPlugin />
      <ValueSyncPlugin value={value} />
      <SingleLinePlugin enabled={singleLine} />
      <ActiveSyncPlugin
        blockId={blockId}
        propName={propName}
        showFontSize={showFontSize}
        variables={variables}
        isFocused={isFocused}
        setIsFocused={setIsFocused}
      />
      <OnChangePlugin
        onChange={(editorState) => {
          editorState.read(() => onChange(exportWhatsAppText()));
        }}
      />
    </div>
  );
}

export function InlineRichText(props: InlineRichTextProps) {
  return (
    <LexicalComposer
      initialConfig={{
        namespace: `inline-rich-text-${props.blockId}-${props.propName}`,
        onError: (error) => {
          throw error;
        },
        theme: {
          paragraph: 'm-0',
          text: {
            bold: 'font-bold text-foreground',
            italic: 'italic',
            strikethrough: 'line-through',
            code: 'rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground',
          },
        },
        editorState: () => importWhatsAppText(props.value),
        editable: true,
      }}
    >
      <InlineEditorInner {...props} />
    </LexicalComposer>
  );
}
