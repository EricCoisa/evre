import { CompanyEditPage } from "../components/company-edit";
import { getCompany } from "@/lib/actions/company/api";

export default async function CompanyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const data = (await getCompany(id)).data;

  return (
    <CompanyEditPage company={data} />
  );
}
