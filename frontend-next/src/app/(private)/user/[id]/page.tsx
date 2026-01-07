import LangLabel from "@/components/ui/langLabel";
import { UserEditPage } from "../components/user-edit";
import UsersRolesPage from "../components/user-roles";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getUser } from "@/lib/actions/user/api";

export default async function UsersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const data = (await getUser(id)).data;


  return (
    <Tabs defaultValue="user" className="">
      <TabsList>
        <TabsTrigger value="user"><LangLabel text="title" langJson="users" /></TabsTrigger>
        <TabsTrigger value="access"><LangLabel text="access" langJson="users" /></TabsTrigger>
      </TabsList>
      <TabsContent value="user"><UserEditPage user={data} /></TabsContent>
      <TabsContent value="access"> <UsersRolesPage user={data} /></TabsContent>
    </Tabs>
  );
}
