'use client';

import { useEffect, useState } from 'react';
import {
  $createTextNode,
  $getRoot,
  $getSelection,
  $isRangeSelection,
  FORMAT_TEXT_COMMAND,
  type TextFormatType,
} from 'lexical';
import { $getSelectionStyleValueForProperty, $patchStyleText } from '@lexical/selection';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { Bold, Braces, Check, Code, Italic, Strikethrough, Type } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/cn';
import { exportWhatsAppText, FONT_SIZE_CSS, importWhatsAppText } from '@/lib/messaging/whatsapp-rich-text';

const FONT_SIZES = [
  { label: 'XS', tw: 'text-xs', css: FONT_SIZE_CSS['text-xs'] },
  { label: 'SM', tw: 'text-sm', css: FONT_SIZE_CSS['text-sm'] },
  { label: 'Base', tw: 'text-base', css: FONT_SIZE_CSS['text-base'] },
  { label: 'LG', tw: 'text-lg', css: FONT_SIZE_CSS['text-lg'] },
  { label: 'XL', tw: 'text-xl', css: FONT_SIZE_CSS['text-xl'] },
  { label: '2XL', tw: 'text-2xl', css: FONT_SIZE_CSS['text-2xl'] },
  { label: '3XL', tw: 'text-3xl', css: FONT_SIZE_CSS['text-3xl'] },
  { label: '4XL', tw: 'text-4xl', css: FONT_SIZE_CSS['text-4xl'] },
] as const;

const CSS_TO_TW: Record<string, string> = Object.fromEntries(
  FONT_SIZES.map((s) => [s.css, s.tw]),
);

export interface RichTextVariableOption {
  /** Nome da variável que será inserida como `{{token}}` no texto. */
  token: string;
  /** Rótulo amigável exibido no menu de variáveis. */
  label: string;
  /** Explicação opcional exibida abaixo no menu. */
  description?: string;
}

interface RichTextInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  disabled?: boolean;
  ariaLabel: string;
  formatLabels: {
    bold: string;
    italic: string;
    strikethrough: string;
    code: string;
  };
  /** Se informado, exibe um botão na barra de formatação para inserir variáveis `{{var}}` no texto. */
  variables?: RichTextVariableOption[];
  variableButtonLabel?: string;
  /** Quando `true`, exibe o picker de tamanho de fonte na toolbar — aplica somente ao texto selecionado. */
  showFontSize?: boolean;
  className?: string;
  onKeyDown?: React.KeyboardEventHandler<HTMLDivElement>;
  onPaste?: React.ClipboardEventHandler<HTMLDivElement>;
  inputRef?: React.Ref<HTMLDivElement>;
}

function ValueSyncPlugin({ value }: { value: string }) {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    const currentValue = editor.getEditorState().read(exportWhatsAppText);
    if (currentValue !== value) {
      editor.update(() => importWhatsAppText(value));
    }
  }, [editor, value]);

  return null;
}

function EditablePlugin({ disabled }: { disabled: boolean }) {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    editor.setEditable(!disabled);
  }, [disabled, editor]);

  return null;
}

export function RichTextFormatButtons({
  editor,
  labels,
  disabled = false,
  variables,
  variableButtonLabel,
  showFontSize = true,
}: {
  editor: LexicalEditor;
  labels?: Partial<RichTextInputProps['formatLabels']>;
  disabled?: boolean;
  variables?: RichTextVariableOption[];
  variableButtonLabel?: string;
  showFontSize?: boolean;
}) {
  const [activeSize, setActiveSize] = useState<string | undefined>(undefined);
  const [activeFormats, setActiveFormats] = useState<Set<TextFormatType>>(new Set());

  useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection)) {
          setActiveSize(undefined);
          setActiveFormats(new Set());
          return;
        }
        const cssValue = $getSelectionStyleValueForProperty(selection, 'font-size', '');
        setActiveSize(cssValue ? CSS_TO_TW[cssValue] : undefined);

        const formats = new Set<TextFormatType>();
        if (selection.hasFormat('bold')) formats.add('bold');
        if (selection.hasFormat('italic')) formats.add('italic');
        if (selection.hasFormat('strikethrough')) formats.add('strikethrough');
        if (selection.hasFormat('code')) formats.add('code');
        setActiveFormats(formats);
      });
    });
  }, [editor]);

  const defaultLabels = {
    bold: labels?.bold ?? 'Negrito (*texto*)',
    italic: labels?.italic ?? 'Itálico (_texto_)',
    strikethrough: labels?.strikethrough ?? 'Riscado (~texto~)',
    code: labels?.code ?? 'Código (```texto```)',
  };

  const buttons: { format: TextFormatType; label: string; icon: React.ReactNode }[] = [
    { format: 'bold', label: defaultLabels.bold, icon: <Bold className="size-3.5" /> },
    { format: 'italic', label: defaultLabels.italic, icon: <Italic className="size-3.5" /> },
    { format: 'strikethrough', label: defaultLabels.strikethrough, icon: <Strikethrough className="size-3.5" /> },
    { format: 'code', label: defaultLabels.code, icon: <Code className="size-3.5" /> },
  ];

  const insertVariable = (token: string) => {
    const snippet = `{{${token}}}`;
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        selection.insertText(snippet);
        return;
      }
      const root = $getRoot();
      const lastChild = root.getLastChild();
      if (lastChild && 'append' in lastChild && typeof lastChild.append === 'function') {
        lastChild.append($createTextNode(snippet));
      }
    });
  };

  const applyFontSize = (css: string) => {
    editor.update(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) return;
      $patchStyleText(selection, { 'font-size': css });
    });
    editor.focus();
  };

  const activeFontSizeEntry = FONT_SIZES.find((s) => s.tw === activeSize);

  return (
    <div className="flex items-center gap-0.5">
      {buttons.map(({ format, label, icon }) => {
        const isActive = activeFormats.has(format);
        return (
          <Button
            key={format}
            type="button"
            size="icon"
            variant="ghost"
            className={cn(
              'size-6 text-muted-foreground hover:text-foreground',
              isActive && 'bg-primary/15 text-primary hover:bg-primary/20 hover:text-primary font-semibold',
            )}
            aria-label={label}
            title={label}
            disabled={disabled}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, format)}
          >
            {icon}
          </Button>
        );
      })}

      {showFontSize ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={disabled}
              className="h-6 gap-1 px-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground"
              aria-label="Tamanho de fonte"
              title="Tamanho de fonte"
              onMouseDown={(event) => event.preventDefault()}
            >
              <Type className="size-3" />
              <span>{activeFontSizeEntry?.label ?? 'Tamanho'}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="min-w-28"
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              editor.focus();
            }}
          >
            {activeSize ? (
              <>
                <DropdownMenuItem onSelect={() => applyFontSize('')}>
                  Padrão
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            ) : null}
            {FONT_SIZES.map((s) => (
              <DropdownMenuItem
                key={s.tw}
                onSelect={() => applyFontSize(s.css)}
                className="gap-2"
              >
                <span className={cn('font-medium', s.tw)}>{s.label}</span>
                {activeSize === s.tw ? <Check className="ml-auto size-3" /> : null}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}

      {variables && variables.length > 0 ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={disabled}
              className="h-6 gap-1 px-1.5 text-[11px] font-medium"
              aria-label={variableButtonLabel ?? 'Inserir variável'}
              title={variableButtonLabel ?? 'Inserir variável'}
              onMouseDown={(event) => event.preventDefault()}
            >
              <Braces className="size-3" />
              <span>{variableButtonLabel ?? 'Variável'}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 text-xs">
            <DropdownMenuLabel className="text-[10px] uppercase text-muted-foreground">
              Inserir variável da fonte
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {variables.map((v) => (
              <DropdownMenuItem
                key={v.token}
                onClick={() => insertVariable(v.token)}
                className="flex flex-col items-start gap-0.5 py-1.5 text-xs"
              >
                <div className="flex w-full items-center justify-between gap-2">
                  <span className="font-medium text-foreground">{v.label}</span>
                  <code className="rounded bg-muted px-1 py-0.5 font-mono text-[10px] text-primary">
                    {`{{${v.token}}}`}
                  </code>
                </div>
                {v.description ? (
                  <span className="text-[10px] text-muted-foreground">{v.description}</span>
                ) : null}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </div>
  );
}

function FormatToolbar({
  labels,
  disabled,
  variables,
  variableButtonLabel,
  showFontSize,
}: {
  labels: RichTextInputProps['formatLabels'];
  disabled: boolean;
  variables?: RichTextVariableOption[];
  variableButtonLabel?: string;
  showFontSize?: boolean;
}) {
  const [editor] = useLexicalComposerContext();

  return (
    <div className="flex flex-wrap items-center justify-between gap-1 border-b px-1 py-0.5">
      <RichTextFormatButtons
        editor={editor}
        labels={labels}
        disabled={disabled}
        variables={variables}
        variableButtonLabel={variableButtonLabel}
        showFontSize={showFontSize}
      />
    </div>
  );
}

export function RichTextInput({
  value,
  onChange,
  placeholder,
  disabled = false,
  ariaLabel,
  formatLabels,
  variables,
  variableButtonLabel,
  showFontSize,
  className,
  onKeyDown,
  onPaste,
  inputRef,
}: RichTextInputProps) {
  return (
    <LexicalComposer
      initialConfig={{
        namespace: 'chat-rich-text',
        onError: (error) => {
          throw error;
        },
        theme: {
          paragraph: 'm-0',
          text: {
            bold: 'font-bold',
            italic: 'italic',
            strikethrough: 'line-through',
            code: 'rounded bg-muted px-1 font-mono text-[0.85em]',
          },
        },
        editorState: () => importWhatsAppText(value),
        editable: !disabled,
      }}
    >
      <div className={`min-w-0 rounded-md border bg-background focus-within:ring-2 focus-within:ring-ring ${className ?? ''}`}>
        <FormatToolbar
          labels={formatLabels}
          disabled={disabled}
          variables={variables}
          variableButtonLabel={variableButtonLabel}
          showFontSize={showFontSize}
        />
        <div className="relative">
          <RichTextPlugin
            contentEditable={
              <ContentEditable
                ref={inputRef}
                aria-label={ariaLabel}
                aria-disabled={disabled}
                aria-multiline="true"
                onKeyDownCapture={onKeyDown}
                onPaste={onPaste}
                className="max-h-36 min-h-10 overflow-y-auto px-3 py-2 text-sm outline-none"
              />
            }
            placeholder={
              <div className="pointer-events-none absolute inset-x-0 top-0 px-3 py-2 text-sm text-muted-foreground">
                {placeholder}
              </div>
            }
            ErrorBoundary={LexicalErrorBoundary}
          />
        </div>
      </div>
      <HistoryPlugin />
      <EditablePlugin disabled={disabled} />
      <ValueSyncPlugin value={value} />
      <OnChangePlugin
        onChange={(editorState) => {
          editorState.read(() => onChange(exportWhatsAppText()));
        }}
      />
    </LexicalComposer>
  );
}
