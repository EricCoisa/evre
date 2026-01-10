'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { useCreateProject } from '@/lib/actions/project/queries';
import { useCompanies } from '@/lib/actions/company/queries';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { useMemo } from 'react';
import { useTranslation } from '@/hooks/use-translation';

interface ProjectCreateProps {
  onSuccess?: () => void;
  companyId?: string;
}

const projectStatuses = ['PROPOSAL', 'REQUIREMENTS', 'DEVELOPMENT', 'DONE'] as const;

export function ProjectCreate({ onSuccess, companyId }: ProjectCreateProps) {
  const { t } = useTranslation('projects');
  const router = useRouter();
  const createProject = useCreateProject();

  const { data: companiesData } = useCompanies({ pagination: false });

  const companies = useMemo(() => {
    if (!companiesData) return [];
    return Array.isArray(companiesData) ? companiesData : companiesData.data;
  }, [companiesData]);

  const formSchema = z.object({
    companyId: z.string().min(1, t('companyRequired')),
    name: z.string().min(1, t('nameRequired')),
    description: z.string().optional(),
    status: z.enum(projectStatuses).optional(),
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      companyId: companyId || '',
      name: '',
      description: '',
      status: 'PROPOSAL',
    },
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      const data = {
        companyId: values.companyId,
        name: values.name,
        ...(values.description && { description: values.description }),
        ...(values.status && { status: values.status }),
      };

      const result = await createProject.mutateAsync(data);

      toast.success(t('createSuccess'));

      if (onSuccess) {
        onSuccess();
      }

      if (result?.id) {
        router.push(`/project/${result.id}`);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'An error occurred');
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="companyId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('company')}</FormLabel>
              <Select 
                onValueChange={field.onChange} 
                value={field.value}
                disabled={!!companyId}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder={t('selectCompany')} />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {companies.map((company) => (
                    <SelectItem key={company.id} value={company.id}>
                      {company.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('name')}</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('description')} (opcional)</FormLabel>
              <FormControl>
                <Textarea {...field} rows={3} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="status"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('status')}</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {projectStatuses.map((status) => (
                    <SelectItem key={status} value={status}>
                      {t(status)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-2">
          <Button type="submit" disabled={createProject.isPending}>
            {createProject.isPending ? 'Creating...' : t('createProject')}
          </Button>
        </div>
      </form>
    </Form>
  );
}
