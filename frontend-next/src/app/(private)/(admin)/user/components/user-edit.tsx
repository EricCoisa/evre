"use client";
import { FormBuilder } from "@/components/form/form-builder";
import { Container } from "@/components/container";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import { useTranslation, type TFunc } from "@/hooks/use-translation";

interface UsersRolesPageProps {
    user: User | null;
    onCancel?: () => void;
    embedded?: boolean;
}

const updateUserSchema = z.object({
    role: z.enum(ROLES).optional(),
    status: z.enum(USER_STATUSES).optional(),
});

function sanitizeSubmitData(data: Record<string, unknown>) {
    return Object.fromEntries(
        Object.entries(data).filter(([_, v]) => v !== undefined)
    );
}

function UserHeaderCard({ name, email, noNameText }: { name?: string | null; email?: string; noNameText: string }) {
    const initials = (name || email || 'U').slice(0, 2).toUpperCase();
    return (
        <div className="flex items-center gap-4 pb-4 mb-4 border-b border-border/60">
            <Avatar className="size-14 text-base">
                <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                    {initials}
                </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-foreground truncate">
                    {name || noNameText}
                </h3>
                <p className="text-sm text-muted-foreground truncate">
                    {email}
                </p>
            </div>
        </div>
    );
}

function useUpdateUserFields(
    rolesData: { label: string }[] | undefined,
    userStatusData: { value: string; label: string }[] | undefined,
    t: TFunc
) {
    return useMemo(() => ({
        role: {
            label: t('role'),
            placeholder: t('rolePlaceholder'),
            description: t('roleDescription'),
            options: rolesData?.map(r => ({ value: r.label, label: r.label })) ?? [],
        },
        status: {
            label: t('status'),
            placeholder: t('statusPlaceholder'),
            description: t('statusDescription'),
            options: userStatusData || [],
        },
    } satisfies FieldConfig<typeof updateUserSchema>), [rolesData, userStatusData, t]);
}

export function UserEditPage({ user, onCancel, embedded = false }: UsersRolesPageProps) {
    const { t } = useTranslation('users');
    const { data: rolesData } = useRoles();
    const { data: userStatusData } = useUserStatus();
    const queryClient = useQueryClient();

    const updateUserFieldConfig = useUpdateUserFields(rolesData, userStatusData, t);

    const handleSubmit = async (data: Record<string, unknown>) => {
        if (!user) return;
        const cleanData = sanitizeSubmitData(data);
        return Alive(() => updateUser(user.id, cleanData))();
    };

    const formElement = (
        <FormBuilder
            key={user?.id || 'edit-form'}
            schema={updateUserSchema}
            fieldConfig={updateUserFieldConfig}
            mode="edit"
            values={user ? { role: user.role, status: user.status } : undefined}
            onCancel={onCancel}
            onSubmit={handleSubmit}
            onSuccess={() => {
                queryClient.invalidateQueries({ queryKey: ['users'] });
            }}
            submitLabel={t('updateUser')}
        />
    );

    if (embedded || onCancel) {
        return formElement;
    }

    return (
        <Container variant="form" padding>
            <UserHeaderCard
                name={user?.name}
                email={user?.email}
                noNameText={t('noName')}
            />
            {formElement}
        </Container>
    );
}
