import { Container } from "@/components/container";
import { PageHeader } from "@/components/page-header";
import { SubNavLayout, type SubNavSection, TabsContent } from "@/components/sub-nav-layout";
import { ItemNotFound } from "@/components/ui/item-not-found";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import LangLabel from "@/components/ui/langLabel";
import { getUser } from "@/lib/actions/user/api";
import { UserEditPage } from "../components/user-edit";
import UsersRolesPage from "../components/user-roles";
import { ArrowLeft, User as UserIcon, Shield } from "lucide-react";
import Link from "next/link";

const userDetailSections: SubNavSection[] = [
  {
    items: [
      {
        id: "user",
        label: <LangLabel text="title" langJson="users" />,
        icon: <UserIcon className="size-4" />,
      },
      {
        id: "access",
        label: <LangLabel text="access" langJson="users" />,
        icon: <Shield className="size-4" />,
      },
    ],
  },
];

/** Server Component: o registro é buscado no servidor com o JWT do cookie e chega renderizado. */
export default async function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const response = await getUser(id);

  if (!response.success || !response.data) {
    return <ItemNotFound itemName="usuário" returnPage="/user" returnLabel="Voltar para Usuários" />;
  }

  const user = response.data;

  return (
    <Container variant="dataTable" border={false}>
      <PageHeader
        title={user.name || user.email}
        description={user.name ? user.email : undefined}
        badge={
          <div className="flex items-center gap-1.5 flex-wrap">
            <Badge variant="outline">{user.role}</Badge>
            <Badge variant={user.status === "ACTIVE" ? "default" : "secondary"}>
              {user.status}
            </Badge>
          </div>
        }
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/user">
              <ArrowLeft className="size-4 mr-1.5" />
              <LangLabel text="tabUsers" langJson="users" />
            </Link>
          </Button>
        }
      />
      <SubNavLayout sections={userDetailSections} defaultTab="user">
        <TabsContent value="user" className="mt-0 space-y-4">
          <UserEditPage user={user} embedded={false} />
        </TabsContent>
        <TabsContent value="access" className="mt-0 space-y-4">
          <UsersRolesPage user={user} />
        </TabsContent>
      </SubNavLayout>
    </Container>
  );
}
