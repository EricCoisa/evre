"use client"

import * as React from "react"
import { useForm, type Control, type FieldValues, type ControllerRenderProps } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"

type FormBuilderControl = Control<FieldValues>;
import { Loader2, User as UserIcon } from "lucide-react"
import { toast } from "sonner"
import { useTranslation } from "@/hooks/use-translation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PhoneInput } from "@/components/ui/phone-input"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { cn } from "@/lib/cn"
import Modal, { type ModalSize } from "@/components/modal"
import { Upload } from "@/components/upload"
import { buildFieldsFromConfig, type FieldConfig } from "@/lib/form/field-config"

/** Erro lançado quando o usuário cancela o submit no meio (ex.: não confirmou um aviso). */
export class SubmitCancelledError extends Error {
  constructor() {
    super('submit cancelled')
    this.name = 'SubmitCancelledError'
  }
}

export type FormBuilderFieldType =
  | 'text' | 'email' | 'password' | 'number' | 'date' | 'datetime-local'
  | 'checkbox' | 'textarea' | 'select' | 'phone'
  | 'file' | 'image' | 'display' | 'custom'

export interface FormBuilderField {
  name: string
  /** DOM id do wrapper do campo — âncora para o Tour (`selectorId`). */
  id?: string
  label: string
  type?: FormBuilderFieldType
  placeholder?: string
  disabled?: boolean
  className?: string
  description?: string
  options?: { value: string; label: string }[]
  /** Existing image/file URL shown as preview (image type) */
  preview?: string
  /** Accept attribute for file/image inputs */
  accept?: string
  /** Render function for custom type */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  render?: (field: ControllerRenderProps<any, any>, isSubmitting: boolean) => React.ReactNode
}

/** Configure the action bar at the bottom of the form */
export interface FormBuilderActions {
  /** submit-only = submit full-width; submit+cancel = submit + cancel; submit+link = submit + link. */
  mode?: 'submit-only' | 'submit+cancel' | 'submit+link'
  link?: { label: string; href?: string; onClick?: () => void }
}

interface FormBuilderProps<TSchema extends z.ZodType<FieldValues>> {
  schema: TSchema
  onSubmit: (data: z.infer<TSchema>) => Promise<unknown>
  fieldConfig?: FieldConfig<TSchema>
  fields?: FormBuilderField[]
  mode?: 'create' | 'edit'
  /** Hydrates the form in edit mode */
  values?: Partial<z.infer<TSchema>>
  /** 'plain' = no wrapper (use inside modal/page); 'card' = bg-card/30 border rounded */
  chrome?: 'card' | 'plain'
  /** Configure action buttons shown at the bottom of the form */
  actions?: FormBuilderActions
  /** When provided, replaces the form content after a successful submit */
  successView?: React.ReactNode
  onSuccess?: (data: unknown) => void
  onError?: (error: Error) => void
  submitLabel?: string
  cancelLabel?: string
  onCancel?: () => void
  className?: string
  /** Set false to skip the default success toast (e.g. intermediate wizard/onboarding steps) */
  showToast?: boolean
  /** Classes for the fields wrapper div. Default is a single-column grid; pass e.g. "grid gap-4 sm:grid-cols-2" for a 2-up layout. */
  gridClassName?: string
  /** Disables Submit while the form matches its last known-good values (react-hook-form `isDirty`). */
  disableSubmitWhenClean?: boolean
}

function resolveBuilderFields(
  fields?: FormBuilderField[],
  fieldConfig?: FieldConfig<z.ZodType<FieldValues>>,
  schema?: z.ZodType<FieldValues>,
): FormBuilderField[] {
  if (fields) return fields;
  if (fieldConfig && schema instanceof z.ZodObject) {
    return buildFieldsFromConfig(schema, fieldConfig) as FormBuilderField[];
  }
  return [];
}

function computeFieldDefaults(
  resolvedFields: FormBuilderField[],
  values?: Record<string, unknown>,
) {
  const defaults: Record<string, unknown> = {};
  resolvedFields.forEach((field) => {
    const editVal = values?.[field.name as keyof typeof values];
    if (editVal !== undefined) {
      defaults[field.name] = editVal;
    } else if (field.type === 'checkbox') {
      defaults[field.name] = false;
    } else if (field.type === 'file' || field.type === 'image' || field.type === 'display') {
      defaults[field.name] = undefined;
    } else {
      defaults[field.name] = '';
    }
  });
  return defaults;
}

interface FormSubmitActionArgs<T> {
  data: T;
  onSubmit: (data: T) => Promise<unknown>;
  mode: 'create' | 'edit';
  successView?: React.ReactNode;
  showToast: boolean;
  onSuccess?: (result: unknown) => void;
  onError?: (err: Error) => void;
  onReset: () => void;
  setSuccessShown: (v: boolean) => void;
  setIsSubmitting: (v: boolean) => void;
  t: (k: string) => string;
}

function handleFormSubmitSuccess<T>(result: unknown, args: FormSubmitActionArgs<T>) {
  if (args.successView) {
    args.setSuccessShown(true);
  } else if (args.showToast) {
    const msg = args.mode === 'edit' ? args.t('updatedSuccessfully') : args.t('successMessage');
    toast.success(msg);
  }
  if (args.mode === 'create') args.onReset();
  args.onSuccess?.(result);
}

function handleFormSubmitError<T>(err: unknown, args: FormSubmitActionArgs<T>) {
  if (err instanceof SubmitCancelledError) return;
  const message = err instanceof Error ? err.message : args.t('errorMessage');
  toast.error(message);
  args.onError?.(err instanceof Error ? err : new Error(message));
}

async function submitFormAction<T>(args: FormSubmitActionArgs<T>) {
  args.setIsSubmitting(true);
  try {
    const result = await args.onSubmit(args.data);
    handleFormSubmitSuccess(result, args);
  } catch (err) {
    handleFormSubmitError(err, args);
  } finally {
    args.setIsSubmitting(false);
  }
}

function FormActionCancel({
  cancelLabel,
  onCancel,
  isSubmitting,
  t,
}: {
  cancelLabel?: string;
  onCancel: () => void;
  isSubmitting: boolean;
  t: (k: string) => string;
}) {
  return (
    <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
      {cancelLabel ?? t('cancel')}
    </Button>
  );
}

function FormActionLink({
  actionsLink,
}: {
  actionsLink: { label: string; href?: string; onClick?: () => void };
}) {
  return (
    <a
      href={actionsLink.href}
      onClick={actionsLink.onClick}
      className="text-sm text-center text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
    >
      {actionsLink.label}
    </a>
  );
}

function FormSubmitButton({
  isSubmitting,
  isSubmitDisabled,
  submitWidth,
  submitLabel,
  t,
}: {
  isSubmitting: boolean;
  isSubmitDisabled: boolean;
  submitWidth?: string;
  submitLabel?: string;
  t: (k: string) => string;
}) {
  return (
    <Button type="submit" disabled={isSubmitDisabled} className={submitWidth}>
      {isSubmitting && <Loader2 className="animate-spin mr-2 size-4" />}
      {submitLabel ?? t('submit')}
    </Button>
  );
}

function FormActionSecondary({
  actionsMode,
  cancelLabel,
  onCancel,
  isSubmitting,
  actionsLink,
  t,
}: {
  actionsMode: 'submit-only' | 'submit+cancel' | 'submit+link';
  cancelLabel?: string;
  onCancel?: () => void;
  isSubmitting: boolean;
  actionsLink?: { label: string; href?: string; onClick?: () => void };
  t: (k: string) => string;
}) {
  if (actionsMode === 'submit+cancel' && onCancel) {
    return <FormActionCancel cancelLabel={cancelLabel} onCancel={onCancel} isSubmitting={isSubmitting} t={t} />;
  }
  if (actionsMode === 'submit+link' && actionsLink) {
    return <FormActionLink actionsLink={actionsLink} />;
  }
  return null;
}

function FormBuilderActions({
  actionsMode,
  resolvedFieldsCount,
  isSubmitting,
  disableSubmitWhenClean,
  isDirty,
  submitLabel,
  cancelLabel,
  onCancel,
  actionsLink,
  t,
}: {
  actionsMode: 'submit-only' | 'submit+cancel' | 'submit+link';
  resolvedFieldsCount: number;
  isSubmitting: boolean;
  disableSubmitWhenClean: boolean;
  isDirty: boolean;
  submitLabel?: string;
  cancelLabel?: string;
  onCancel?: () => void;
  actionsLink?: { label: string; href?: string; onClick?: () => void };
  t: (k: string) => string;
}) {
  const isSubmitDisabled = isSubmitting || (disableSubmitWhenClean && !isDirty);
  const isStack = actionsMode === 'submit-only' || actionsMode === 'submit+link';
  const submitWidth = actionsMode !== 'submit+cancel' ? 'w-full' : undefined;

  return (
    <div
      className={cn(
        'flex pt-4',
        resolvedFieldsCount > 0 && 'border-t border-border/50',
        isStack ? 'flex-col gap-2' : 'gap-3',
      )}
    >
      <FormSubmitButton
        isSubmitting={isSubmitting}
        isSubmitDisabled={isSubmitDisabled}
        submitWidth={submitWidth}
        submitLabel={submitLabel}
        t={t}
      />

      <FormActionSecondary
        actionsMode={actionsMode}
        cancelLabel={cancelLabel}
        onCancel={onCancel}
        isSubmitting={isSubmitting}
        actionsLink={actionsLink}
        t={t}
      />
    </div>
  );
}

function FormImageField({
  field,
  control,
}: {
  field: FormBuilderField;
  control: FormBuilderControl;
}) {
  return (
    <FormField
      key={field.name}
      control={control}
      name={field.name as never}
      render={({ field: f }) => {
        const val = f.value as unknown;
        const previewUrl =
          val instanceof File
            ? URL.createObjectURL(val)
            : typeof val === 'string' && val
              ? val
              : field.preview ?? null;
        return (
          <FormItem id={field.id} className={field.className}>
            {field.label && <FormLabel>{field.label}</FormLabel>}
            <FormControl>
              <Upload
                accept={field.accept ?? 'image/*'}
                disabled={field.disabled}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) f.onChange(file);
                }}
              >
                <Avatar className="size-20">
                  {previewUrl && <AvatarImage src={previewUrl} alt={field.label} />}
                  <AvatarFallback>
                    <UserIcon className="size-8 text-muted-foreground" />
                  </AvatarFallback>
                </Avatar>
              </Upload>
            </FormControl>
            {field.description && <FormDescription>{field.description}</FormDescription>}
            <FormMessage />
          </FormItem>
        );
      }}
    />
  );
}

function FormFileField({
  field,
  control,
  isSubmitting,
}: {
  field: FormBuilderField;
  control: FormBuilderControl;
  isSubmitting: boolean;
}) {
  return (
    <FormField
      key={field.name}
      control={control}
      name={field.name as never}
      render={({ field: f }) => (
        <FormItem id={field.id} className={field.className}>
          <FormLabel>{field.label}</FormLabel>
          <FormControl>
            <Input
              type="file"
              accept={field.accept}
              disabled={field.disabled || isSubmitting}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) f.onChange(file);
              }}
            />
          </FormControl>
          {field.description && <FormDescription>{field.description}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

function FormCustomField({
  field,
  control,
  isSubmitting,
}: {
  field: FormBuilderField;
  control: FormBuilderControl;
  isSubmitting: boolean;
}) {
  return (
    <FormField
      key={field.name}
      control={control}
      name={field.name as never}
      render={({ field: f }) => (
        <FormItem id={field.id} className={field.className}>
          {field.label && <FormLabel>{field.label}</FormLabel>}
          <FormControl>
            <span>{field.render?.(f, isSubmitting) ?? null}</span>
          </FormControl>
          {field.description && <FormDescription>{field.description}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

function FormPhoneField({
  field,
  control,
  isSubmitting,
}: {
  field: FormBuilderField;
  control: FormBuilderControl;
  isSubmitting: boolean;
}) {
  return (
    <FormField
      key={field.name}
      control={control}
      name={field.name as never}
      render={({ field: f }) => (
        <FormItem id={field.id} className={field.className}>
          <FormLabel>{field.label}</FormLabel>
          <FormControl>
            <PhoneInput
              value={(f.value as string) ?? ''}
              onChange={f.onChange}
              disabled={field.disabled || isSubmitting}
              placeholder={field.placeholder}
            />
          </FormControl>
          {field.description && <FormDescription>{field.description}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

function FormSelectField({
  field,
  control,
  isSubmitting,
  t,
}: {
  field: FormBuilderField;
  control: FormBuilderControl;
  isSubmitting: boolean;
  t: (k: string) => string;
}) {
  return (
    <FormField
      key={field.name}
      control={control}
      name={field.name as never}
      render={({ field: f }) => (
        <FormItem id={field.id} className={field.className}>
          <FormLabel>{field.label}</FormLabel>
          <Select onValueChange={f.onChange} value={f.value ?? ''} disabled={field.disabled || isSubmitting}>
            <FormControl>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={field.placeholder ?? t('selectPlaceholder')} />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              {field.options?.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {field.description && <FormDescription>{field.description}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

function FormTextareaField({
  field,
  control,
  isSubmitting,
}: {
  field: FormBuilderField;
  control: FormBuilderControl;
  isSubmitting: boolean;
}) {
  return (
    <FormField
      key={field.name}
      control={control}
      name={field.name as never}
      render={({ field: f }) => (
        <FormItem id={field.id} className={field.className}>
          <FormLabel>{field.label}</FormLabel>
          <FormControl>
            <textarea
              {...f}
              placeholder={field.placeholder}
              disabled={field.disabled || isSubmitting}
              className="min-h-20 w-full rounded-md border-2 border-primary-300 dark:border-primary-600 bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:border-primary-500 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive"
            />
          </FormControl>
          {field.description && <FormDescription>{field.description}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

function FormCheckboxField({
  field,
  control,
  isSubmitting,
}: {
  field: FormBuilderField;
  control: FormBuilderControl;
  isSubmitting: boolean;
}) {
  return (
    <FormField
      key={field.name}
      control={control}
      name={field.name as never}
      render={({ field: f }) => (
        <FormItem id={field.id} className={cn("flex items-center gap-2 space-y-0", field.className)}>
          <FormControl>
            <input
              type="checkbox"
              checked={f.value}
              onBlur={f.onBlur}
              onChange={f.onChange}
              disabled={field.disabled || isSubmitting}
              className="size-4 rounded border-input"
            />
          </FormControl>
          <FormLabel className="font-normal cursor-pointer">{field.label}</FormLabel>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

function FormDefaultField({
  field,
  control,
  isSubmitting,
}: {
  field: FormBuilderField;
  control: FormBuilderControl;
  isSubmitting: boolean;
}) {
  return (
    <FormField
      key={field.name}
      control={control}
      name={field.name as never}
      render={({ field: f }) => (
        <FormItem id={field.id} className={field.className}>
          <FormLabel>{field.label}</FormLabel>
          <FormControl>
            <Input
              {...f}
              type={field.type ?? 'text'}
              placeholder={field.placeholder}
              disabled={field.disabled || isSubmitting}
              onChange={(e) => f.onChange(field.type === 'number' ? e.target.valueAsNumber : e.target.value)}
            />
          </FormControl>
          {field.description && <FormDescription>{field.description}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

function FormDisplayField({ field }: { field: FormBuilderField }) {
  const placeholder = field.placeholder ?? '';
  return (
    <FormItem key={field.name} id={field.id} className={field.className}>
      <FormLabel>{field.label}</FormLabel>
      <Input value={placeholder} disabled readOnly className="cursor-default" />
      {field.description && <FormDescription>{field.description}</FormDescription>}
    </FormItem>
  );
}

function renderSpecialField(
  field: FormBuilderField,
  control: FormBuilderControl,
  isSubmitting: boolean,
  t: (k: string) => string,
) {
  switch (field.type) {
    case 'image':
      return <FormImageField field={field} control={control} />;
    case 'file':
      return <FormFileField field={field} control={control} isSubmitting={isSubmitting} />;
    case 'display':
      return <FormDisplayField field={field} />;
    case 'custom':
      return <FormCustomField field={field} control={control} isSubmitting={isSubmitting} />;
    case 'phone':
      return <FormPhoneField field={field} control={control} isSubmitting={isSubmitting} />;
    case 'select':
      return <FormSelectField field={field} control={control} isSubmitting={isSubmitting} t={t} />;
    case 'textarea':
      return <FormTextareaField field={field} control={control} isSubmitting={isSubmitting} />;
    case 'checkbox':
      return <FormCheckboxField field={field} control={control} isSubmitting={isSubmitting} />;
    default:
      return null;
  }
}

function useFormBuilderCore<TSchema extends z.ZodType<FieldValues>>(
  props: FormBuilderProps<TSchema>,
  t: (k: string) => string,
) {
  const {
    schema,
    onSubmit,
    fieldConfig,
    fields,
    values,
    actions,
    successView,
    onSuccess,
    onError,
    onCancel,
  } = props;
  const mode = props.mode ?? 'create';
  const showToast = props.showToast ?? true;
  const disableSubmitWhenClean = props.disableSubmitWhenClean ?? false;

  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [successShown, setSuccessShown] = React.useState(false);

  const resolvedFields = React.useMemo<FormBuilderField[]>(() => {
    return resolveBuilderFields(fields, fieldConfig, schema);
  }, [fields, fieldConfig, schema]);

  const computedDefaults = React.useMemo(() => {
    return computeFieldDefaults(resolvedFields, values);
  }, [resolvedFields, values]);

  const form = useForm<z.infer<TSchema>>({
    resolver: zodResolver(schema as never),
    defaultValues: computedDefaults as never,
  });

  React.useEffect(() => {
    if (mode === 'edit') {
      form.reset(computedDefaults as z.infer<TSchema>);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, JSON.stringify(values)]);

  const handleFormSubmit = async (data: z.infer<TSchema>) => {
    await submitFormAction({
      data,
      onSubmit,
      mode,
      successView,
      showToast,
      onSuccess,
      onError,
      onReset: () => form.reset(),
      setSuccessShown,
      setIsSubmitting,
      t,
    });
  };

  const handleCancel = () => {
    form.reset();
    onCancel?.();
  };

  const actionsMode = actions?.mode ?? (onCancel ? 'submit+cancel' : 'submit-only');

  return {
    form,
    isSubmitting,
    successShown,
    resolvedFields,
    handleFormSubmit,
    handleCancel,
    actionsMode,
    disableSubmitWhenClean,
  };
}

export function FormBuilder<TSchema extends z.ZodType<FieldValues>>(props: FormBuilderProps<TSchema>) {
  const {
    actions,
    successView,
    submitLabel,
    cancelLabel,
    className,
    gridClassName,
  } = props;
  const chrome = props.chrome ?? 'plain';
  const { t } = useTranslation('common');

  const {
    form,
    isSubmitting,
    successShown,
    resolvedFields,
    handleFormSubmit,
    handleCancel,
    actionsMode,
    disableSubmitWhenClean,
  } = useFormBuilderCore(props, t);

  if (successShown && successView) {
    return <>{successView}</>;
  }

  const formContent = (
    <Form {...form}>
      <form method="post" onSubmit={form.handleSubmit(handleFormSubmit)} className={cn("space-y-4", className)}>
        <div className={gridClassName ?? "grid gap-4"}>
          {resolvedFields.map((field) => {
            const special = renderSpecialField(field, form.control as never, isSubmitting, t);
            if (special) return special;
            return <FormDefaultField key={field.name} field={field} control={form.control as never} isSubmitting={isSubmitting} />;
          })}
        </div>

        <FormBuilderActions
          actionsMode={actionsMode}
          resolvedFieldsCount={resolvedFields.length}
          isSubmitting={isSubmitting}
          disableSubmitWhenClean={disableSubmitWhenClean}
          isDirty={form.formState.isDirty}
          submitLabel={submitLabel}
          cancelLabel={cancelLabel}
          onCancel={handleCancel}
          actionsLink={actions?.link}
          t={t}
        />
      </form>
    </Form>
  );

  if (chrome === 'card') {
    return (
      <div className="bg-card/30 backdrop-blur-sm border border-border rounded-lg p-6">
        {formContent}
      </div>
    );
  }

  return formContent;
}

// Thin wrapper: FormBuilder inside Modal, always chrome="plain"
export interface FormBuilderModalProps<TSchema extends z.ZodType<FieldValues>>
  extends Omit<FormBuilderProps<TSchema>, 'chrome'> {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  size?: ModalSize
  modalClassName?: string
}

export function FormBuilderModal<TSchema extends z.ZodType<FieldValues>>({
  open,
  onOpenChange,
  title,
  description,
  size = 'md',
  modalClassName,
  onSuccess,
  onCancel,
  ...formProps
}: FormBuilderModalProps<TSchema>) {
  const handleSuccess = (data: unknown) => {
    onOpenChange(false)
    onSuccess?.(data)
  }

  const handleCancel = () => {
    onOpenChange(false)
    onCancel?.()
  }

  return (
    <Modal
      title={title}
      description={description}
      open={open}
      onOpenChange={onOpenChange}
      size={size}
      className={modalClassName}
    >
      <FormBuilder
        {...formProps}
        chrome="plain"
        onSuccess={handleSuccess}
        onCancel={handleCancel}
      />
    </Modal>
  )
}
