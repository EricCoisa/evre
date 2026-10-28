import { Badge } from '@/components/ui/badge';
import { userRoleColors } from '@/lib/actions/userConfiguration/types';

export function RoleBadge({ role, children }: { role: string; children: React.ReactNode }) {
  return (
    <Badge style={userRoleColors[role]}>
      {children}
    </Badge>
  );
}
