'use client';

import {
  $getRoot,
  $getSelection,
  $isRangeSelection,
  FORMAT_TEXT_COMMAND,
  type EditorState,
  type TextFormatType,
} from 'lexical';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { Bold, Italic, Strikethrough, Code } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { VariableButtons } from '@/components/variable-insert';
import type { ReservedVariable, TemplateVariable } from '@/lib/actions/messaging/types';
import { exportWhatsAppText, importWhatsAppText } from '@/lib/messaging/whatsapp-rich-text';

function FormatToolbar() {
  const [editor] = useLexicalComposerContext();
  const format = (type: TextFormatType) => editor.dispatchCommand(FORMAT_TEXT_COMMAND, type);
  return (
    <div className="flex items-center gap-1 border-b border-primary-300 p-1 dark:border-primary-600">
      <Button type="button" size="icon-sm" variant="ghost" title="Negrito (*texto*)" onClick={() => format('bold')}>
        <Bold className="size-4" />
      </Button>
      <Button type="button" size="icon-sm" variant="ghost" title="Itálico (_texto_)" onClick={() => format('italic')}>
        <Italic className="size-4" />
      </Button>
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        title="Riscado (~texto~)"
        onClick={() => format('strikethrough')}
      >
        <Strikethrough className="size-4" />
      </Button>
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        title="Monoespaçado (```texto```)"
        onClick={() => format('code')}
      >
        <Code className="size-4" />
      </Button>
    </div>
  );
}

function VariableInsertRow({
  variables,
  reserved,
  usedNames,
}: {
  variables: TemplateVariable[];
  reserved: ReservedVariable[];
  usedNames: Set<string>;
}) {
  const [editor] = useLexicalComposerContext();
  const insert = (name: string) => {
    editor.update(() => {
      let selection = $getSelection();
      if (!$isRangeSelection(selection)) {
        $getRoot().selectEnd();
        selection = $getSelection();
      }
      if ($isRangeSelection(selection)) selection.insertText(`{{ ${name} }}`);
    });
    editor.focus();
  };
  return (
    <VariableButtons
      variables={variables}
      reserved={reserved}
      usedNames={usedNames}
      onInsert={insert}
    />
  );
}

export function TemplateBodyEditor({
  label,
  initialValue,
  onChange,
  variables,
  reserved,
  usedNames,
}: {
  label: string;
  initialValue: string;
  onChange: (text: string) => void;
  variables: TemplateVariable[];
  reserved: ReservedVariable[];
  usedNames: Set<string>;
}) {
  return (
    <div className="group grid gap-1.5">
      <Label>{label}</Label>
      <LexicalComposer
        initialConfig={{
          namespace: 'template-body',
          onError: (error) => {
            throw error;
          },
          editorState: () => {
            importWhatsAppText(initialValue);
          },
        }}
      >
        <div className="focus-within:border-primary-500 focus-within:ring-[3px] focus-within:ring-primary-200 dark:focus-within:ring-primary-800 rounded-md border-2 border-primary-300 dark:border-primary-600">
          <FormatToolbar />
          <RichTextPlugin
            contentEditable={
              <ContentEditable className="min-h-28 w-full bg-transparent px-3 py-2 text-sm outline-none" />
            }
            placeholder={null}
            ErrorBoundary={LexicalErrorBoundary}
          />
        </div>
        <HistoryPlugin />
        <OnChangePlugin
          onChange={(editorState: EditorState) => {
            editorState.read(() => {
              onChange(exportWhatsAppText());
            });
          }}
        />
        {/* Só aparece com o editor ativo — senão a tela fica poluída com botões de todo campo. */}
        <div className="hidden group-focus-within:block">
          <VariableInsertRow variables={variables} reserved={reserved} usedNames={usedNames} />
        </div>
      </LexicalComposer>
    </div>
  );
}
