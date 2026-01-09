"use client";

import React from 'react';
import { cn } from '@/lib/utils';
import { User, Building, UserCheck } from 'lucide-react';

interface PartyProps {
  value: {
    name: string;
    document?: string;
    address?: string;
    role: 'contractor' | 'contracted' | 'witness';
  };
  className?: string;
}

const roleLabels = {
  contractor: 'Contratante',
  contracted: 'Contratado',
  witness: 'Testemunha',
};

const roleIcons = {
  contractor: Building,
  contracted: User,
  witness: UserCheck,
};

export function Party({ value, className }: PartyProps) {
  const Icon = roleIcons[value.role];

  return (
    <div className={cn('p-4 rounded-lg border bg-card', className)}>
      <div className="flex items-center gap-2 mb-3">
        <Icon className="h-5 w-5 text-primary" />
        <span className="font-semibold text-sm text-primary">
          {roleLabels[value.role]}
        </span>
      </div>
      <div className="space-y-1">
        <p className="font-medium">{value.name}</p>
        {value.document && (
          <p className="text-sm text-muted-foreground">
            Documento: {value.document}
          </p>
        )}
        {value.address && (
          <p className="text-sm text-muted-foreground">
            Endereço: {value.address}
          </p>
        )}
      </div>
    </div>
  );
}
