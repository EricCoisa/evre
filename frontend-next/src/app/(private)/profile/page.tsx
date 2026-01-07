'use client';

import { Container } from "@/components/container";
import { useTranslation } from 'next-i18next';
import { UserConfiguration } from '@/components/user-configuration';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { GenericCreateFormModal } from "@/components/generic-create-form";
import z from "zod";
import { FieldConfig } from "@/lib/form/field-config";
import { useMemo, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Edit } from "lucide-react";
import { updatePassword, updateProfile } from "@/lib/actions/user/api";
import { toast } from "sonner";
import { useMe } from "@/lib/actions/auth/queries";
import { useQueryClient } from "@tanstack/react-query";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { UpdateProfileDto } from "@/lib/actions/user/types";
import { Upload } from "@/components/upload";
import { Title } from "@/components/ui/label";
import { Alive } from "@/lib/api/collector";

export default function ProfilePage() {
  const { t } = useTranslation('profile');
  const { data: user } = useMe();
  const queryClient = useQueryClient();
  const [imageTemp, setImageTemp] = useState<string | null>(null);

  const updatePasswordSchema = z.object({
    currentPassword: z.string().min(1, t('currentPasswordRequired')),
    newPassword: z.string()
      .min(8, t('passwordMin'))
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]/,
        t('passwordRequirements')
      ),
    confirmNewPassword: z.string().min(8, t('confirmPasswordMin')),
  }).refine(
    (data) => data.newPassword === data.confirmNewPassword,
    {
      message: t('passwordsDoNotMatch'),
      path: ['confirmNewPassword'],
    }
  );

  const updatePasswordFieldConfig = useMemo(() => ({
    currentPassword: {
      label: 'Senha Atual',
      type: 'password' as const,
      placeholder: 'Senha atual',
      description: 'Senha atual do usuário',
    },
    newPassword: {
      label: 'Nova Senha',
      type: 'password' as const,
      placeholder: 'Nova senha',
      description: 'Nova senha do usuário',
    },
    confirmNewPassword: {
      label: 'Confirme a Nova Senha',
      type: 'password' as const,
      placeholder: 'Confirme a nova senha',
      description: 'Confirmação da nova senha do usuário',
    }
  } satisfies FieldConfig<typeof updatePasswordSchema>), [user]);

  const updateProfileSchema = z.object({ //TODO: traduzir
    // email: z.string().min(1, 'Email é obrigatório').email('Email inválido').optional(),
    name: z.string().optional(),
    image: z.instanceof(File).optional(), // para arquivo de imagem
  });

  const form = useForm<UpdateProfileDto & { image?: File }>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: {
      // email: user?.email || "",
      name: user?.name || "",
      image: undefined,
    },
  });

  // Atualiza o formulário quando os dados do usuário mudarem
  useEffect(() => {
    if (user) {
      form.reset({
        // email: user.email || "",
        name: user.name || "",
        image: undefined,
      });
    }
  }, [user, form]);

  if (!user) {
    return <div>{t('loading')}...</div>;
  }


  const onSubmit = async (data: UpdateProfileDto): Promise<unknown> => {
    // Verifica se houve alteração
    const isUnchanged =
      // data.email === user?.email &&
      data.name === user?.name &&
      (!('image' in data) || !data.image);
    if (isUnchanged) {
      toast.info(t('noChanges'));
      return;
    }
    try {
      const result = await updateProfile(user.id, data);
      queryClient.invalidateQueries({ queryKey: ['me'] });
      toast.success(t('common:updatedSuccessfully'));
      return result;
    } catch (err) {
      toast.error(t('common:errorMessage'));
      throw err;
    }
  };



  return (
    <Container border={false}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 auto-rows-fr">
        {/* Container de Informações do Perfil */}
        <Container variant="default" padding>
          <div className="flex items-center gap-2 mb-4">
            <Title className="flex-1 truncate min-w-0">{user.name}</Title>
            <GenericCreateFormModal
              trigger={
                <Button>
                  <Edit /> {t('updatePassword')}
                </Button>
              }
              schema={updatePasswordSchema}
              fieldConfig={updatePasswordFieldConfig}
              title={t('updatePassword')}
              description={t('updatePassword')}
              onSubmit={async (data) => {
                const result = await Alive(() => updatePassword(user.id, data))();
                return result;
              }}
              onSuccess={() => {
                // Invalida a query para recarregar a lista
                queryClient.invalidateQueries({ queryKey: ['me'] });
              }}
              onError={(error) => {
                console.error('Erro ao alterar a senha:', error);
              }}
              submitLabel={t('updatePassword')}
            />
          </div>



          <Form {...form}>
            <div className="flex flex-col md:flex-row items-center md:items-center gap-6">
              {/* Avatar à esquerda */}
              <div className="shrink-0 flex items-center justify-center w-full md:w-[110px] mb-4 md:mb-0">
                <FormField
                  control={form.control}
                  name="image"
                  render={({ field }) => (
                    <FormItem>
                     <Upload 
                        {...field} 
                        accept="image/*" 
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            field.onChange(file); // Atualiza o formulário
                            setImageTemp(URL.createObjectURL(file)); // Atualiza o preview
                          }
                        }}
                      >
                        <Avatar className="h-30 w-30 bg">
                          <AvatarImage src={imageTemp ?? (user.image ?? undefined)} />
                          <AvatarFallback>{user.name?.charAt(0)}</AvatarFallback>
                        </Avatar>
                      </Upload>
                    </FormItem>
                  )}
                />

              </div>
              {/* Dados à direita */}
              <div className="space-y-4 w-full">

                {/* Formulário de atualização do perfil */}


                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
   
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder={user.email || "usuario@exemplo.com"} disabled />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                  
          
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome</FormLabel>
                        <FormControl>
                          <Input placeholder={user.name || "Nome completo"} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit">{t('updateProfileButton')}</Button>
                </form>



              </div>
            </div>
          </Form>
        </Container>

        {/* Container de Preferências */}
        <Container variant="default" padding title={t('preferencesTitle')}>
          <div className="space-y-4">
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium">{t('userconfig_theme')}</h3>
                  <p className="text-muted-foreground text-sm">
                    {t('userconfig_desc_theme')}
                  </p>
                </div>
                <UserConfiguration disableLabel={true} labelKey="USERCONFIG_THEME" />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium">{t('usertour')}</h3>
                  <p className="text-muted-foreground text-sm">
                    {t('userconfig_desc_tour')}
                  </p>
                </div>
                <UserConfiguration showMessage={false} disableLabel={true} forceType="button" labelKey="USERTOUR" />
              </div>
            </div>
          </div>
        </Container>
      </div>
    </Container>
  );
}
