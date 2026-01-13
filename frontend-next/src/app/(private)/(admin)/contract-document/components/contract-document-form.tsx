"use client";

import React, { useState, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslation } from "react-i18next";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useCompanies } from "@/lib/actions/company/queries";
import { useProjects } from "@/lib/actions/project/queries";
import { useProposalsByCompany } from "@/lib/actions/proposal/queries";

interface ContractDocumentFormProps {
  onSubmit: (data: ContractDocumentFormData) => Promise<void>;
  onCancel?: () => void;
  isSubmitting?: boolean;
}

export interface ContractDocumentFormData {
  companyId: string;  // Usado apenas no frontend para filtros
  projectId: string;
  proposalId?: string;
  name: string;
  content: string;
  contentSchemaVersion?: string;
}

export function ContractDocumentForm({
  onSubmit,
  onCancel,
  isSubmitting = false,
}: ContractDocumentFormProps) {
  const { t } = useTranslation("contractDocument");
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("");

  // Busca companies
  const { data: companiesData } = useCompanies({ pagination: false });

  // Busca projects filtrados por company
  const { data: projectsData } = useProjects(
    selectedCompanyId
      ? {
          pagination: false,
          filter: JSON.stringify({ companyId: selectedCompanyId }),
        }
      : undefined
  );

  // Busca proposals filtradas por company
  const { data: proposalsData } = useProposalsByCompany(
    selectedCompanyId || ""
  );

  const companyOptions = useMemo(() => {
    if (!companiesData || Array.isArray(companiesData)) {
      const companies = Array.isArray(companiesData) ? companiesData : [];
      return companies.map((company) => ({
        value: company.id,
        label: company.name,
      }));
    }
    return [];
  }, [companiesData]);

  const projectOptions = useMemo(() => {
    if (!selectedCompanyId) return [];
    if (!projectsData || Array.isArray(projectsData)) {
      const projects = Array.isArray(projectsData) ? projectsData : [];
      return projects.map((project) => ({
        value: project.id,
        label: project.name,
      }));
    }
    return [];
  }, [projectsData, selectedCompanyId]);

  const proposalOptions = useMemo(() => {
    if (!selectedCompanyId) return [];
    const proposals = proposalsData || [];
    return proposals.map((proposal) => ({
      value: proposal.id,
      label: proposal.name,
    }));
  }, [proposalsData, selectedCompanyId]);

  const schema = z.object({
    companyId: z
      .string()
      .uuid(t("companyIdRequired") || "ID da empresa inválido"),
    projectId: z
      .string()
      .uuid(t("projectIdRequired") || "ID do projeto inválido"),
    proposalId: z
      .string()
      .uuid(t("proposalIdInvalid") || "ID da proposta inválido")
      .optional()
      .or(z.literal("")),
    name: z.string().min(1, t("nameRequired") || "Nome obrigatório"),
    content: z.string().min(1, t("contentRequired") || "Conteúdo obrigatório"),
    contentSchemaVersion: z.string().optional().default("v1"),
  });

  const form = useForm<ContractDocumentFormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      companyId: "",
      projectId: "",
      proposalId: "",
      name: "",
      content: "",
      contentSchemaVersion: "v1",
    },
  });

  const handleSubmit = async (data: ContractDocumentFormData) => {
    // Remove companyId antes de enviar (usado apenas para filtros no frontend)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { companyId, ...submitData } = data;
    await onSubmit(submitData as ContractDocumentFormData);
  };

  return (
    <div className="bg-card/30 backdrop-blur-sm border border-border rounded-lg p-6">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
          {/* Company Select */}
          <FormField
            control={form.control}
            name="companyId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  {t("companyId") || "Empresa"}
                  <span className="text-destructive ml-1">*</span>
                </FormLabel>
                <Select
                  onValueChange={(value) => {
                    field.onChange(value);
                    setSelectedCompanyId(value);
                    // Limpa os campos dependentes
                    form.setValue("projectId", "");
                    form.setValue("proposalId", "");
                  }}
                  value={field.value}
                  disabled={isSubmitting}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue
                        placeholder={
                          t("companyIdPlaceholder") || "Selecione uma empresa"
                        }
                      />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {companyOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Project Select (conditional) */}
          <FormField
            control={form.control}
            name="projectId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  {t("projectId") || "Projeto"}
                  <span className="text-destructive ml-1">*</span>
                </FormLabel>
                <Select
                  onValueChange={field.onChange}
                  value={field.value}
                  disabled={!selectedCompanyId || isSubmitting}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue
                        placeholder={
                          !selectedCompanyId
                            ? t("selectCompanyFirst") ||
                              "Selecione uma empresa primeiro"
                            : t("projectIdPlaceholder") ||
                              "Selecione um projeto"
                        }
                      />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {projectOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Proposal Select (conditional, optional) */}
          <FormField
            control={form.control}
            name="proposalId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("proposalId") || "Proposta (Opcional)"}</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  value={field.value}
                  disabled={!selectedCompanyId || isSubmitting}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue
                        placeholder={
                          !selectedCompanyId
                            ? t("selectCompanyFirst") ||
                              "Selecione uma empresa primeiro"
                            : t("proposalIdPlaceholder") ||
                              "Selecione uma proposta (opcional)"
                        }
                      />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {proposalOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Name Input */}
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  {t("name") || "Nome"}
                  <span className="text-destructive ml-1">*</span>
                </FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    placeholder={
                      t("namePlaceholder") || "Digite o nome do contrato"
                    }
                    disabled={isSubmitting}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Content Textarea */}
          <FormField
            control={form.control}
            name="content"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  {t("content") || "Conteúdo"}
                  <span className="text-destructive ml-1">*</span>
                </FormLabel>
                <FormControl>
                  <Textarea
                    {...field}
                    placeholder={
                      t("contentPlaceholder") || "Digite o conteúdo JSON"
                    }
                    disabled={isSubmitting}
                    rows={10}
                    className="font-mono text-xs"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Content Schema Version Input */}
          <FormField
            control={form.control}
            name="contentSchemaVersion"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("version") || "Versão do Schema"}</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    placeholder={t("versionPlaceholder") || "v1"}
                    disabled={isSubmitting}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Action Buttons */}
          <div className="flex justify-end gap-2 pt-4">
            {onCancel && (
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                disabled={isSubmitting}
              >
                {t("cancel") || "Cancelar"}
              </Button>
            )}
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting
                ? t("creating") || "Criando..."
                : t("createNew") || "Criar"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
