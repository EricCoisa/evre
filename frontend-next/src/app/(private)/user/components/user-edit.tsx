"use client";
import { GenericCreateForm } from "@/components/generic-create-form";
import { updateUser } from "@/lib/actions/user/api";
import { useRoles, useUserStatus } from "@/lib/actions/user/queries";
import { User } from "@/lib/actions/user/types";
import { Alive } from "@/lib/api/collector";
import { FieldConfig } from "@/lib/form/field-config";
import { ROLES } from "@/types/roles";
import { USER_STATUSES } from "@/types/status";
import { useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { z } from 'zod';

interface UsersRolesPageProps {
    user: User | null;
    onCancel?: () => void;
}

export function UserEditPage({ user, onCancel }: UsersRolesPageProps) {
    const { data: rolesData } = useRoles();
    const { data: userStatusData } = useUserStatus();
    const queryClient = useQueryClient();

    const updateUserSchema = z.object({ //TODO: traduzir
        // email: z.string().min(1, 'Email é obrigatório').email('Email inválido').optional(),
        // password: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres').optional(),
        // name: z.string().optional(),
        role: z.enum(ROLES).optional(),
        status: z.enum(USER_STATUSES).optional(),
    });

    const updateUserFieldConfig = useMemo(() => ({
        // email: {
        //     label: 'Email',
        //     type: 'email' as const,
        //     placeholder: 'usuario@exemplo.com',
        //     description: 'Email do usuário',
        // },
        // password: {
        //     label: 'Nova Senha',
        //     type: 'password' as const,
        //     placeholder: 'Deixe em branco para manter',
        //     description: 'Senha de acesso (opcional)',
        // },
        // name: {
        //     label: 'Nome',
        //     placeholder: 'Nome completo',
        //     description: 'Nome do usuário',
        // },
        role: {
            label: 'Tipo de Usuário',
            placeholder: 'Selecione o tipo',
            description: 'Nível de permissão',
            options: rolesData || [],
        },
        status: {
            label: 'Status',
            placeholder: 'Selecione o status',
            description: 'Status do usuário',
            options: userStatusData || [],
        },
    } satisfies FieldConfig<typeof updateUserSchema>), [rolesData, userStatusData]);


    return (
        <GenericCreateForm
            key={user?.id || 'edit-form'}
            schema={updateUserSchema}
            fieldConfig={updateUserFieldConfig}
            onCancel={onCancel}
            onSubmit={async (data) => {
                if (!user) return;
                // Remove campos vazios/undefined
                const cleanData = Object.fromEntries(
                    // eslint-disable-next-line @typescript-eslint/no-unused-vars
                    Object.entries(data).filter(([_, v]) => v !== undefined)
                );
                const result = await Alive(() => updateUser(user.id, cleanData))();
                return result;
            }}
            onSuccess={(result) => {
                queryClient.invalidateQueries({ queryKey: ['users'] });
            }}
            onError={(error) => {
                console.error('Erro ao atualizar usuário:', error);
            }}
            submitLabel="Atualizar Usuário"
            defaultValues={user ? {
                // name: user.name || '',
                // email: user.email,
                role: user.role,
                status: user.status,
            } : undefined}
        />
    )
}