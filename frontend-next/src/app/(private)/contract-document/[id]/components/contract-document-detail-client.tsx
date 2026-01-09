'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowLeft, Edit, Save, X, Send, CheckCircle, Archive } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import type { ContractDocument } from '@/lib/actions/contract-document/types';
import { ContractStatusColors } from '@/lib/actions/contract-document/types';
import {
  useUpdateContractDocumentContent,
  useSendContractDocument,
  useAcceptContractDocument,
  useArchiveContractDocument,
} from '@/lib/actions/contract-document/queries';
import { Container } from '@/components/container';

interface ContractDocumentDetailClientProps {
  contract: ContractDocument;
}

export function ContractDocumentDetailClient({
  contract,
}: ContractDocumentDetailClientProps) {
  const router = useRouter();
  const updateContentMutation = useUpdateContractDocumentContent();
  const sendContractMutation = useSendContractDocument();
  const acceptContractMutation = useAcceptContractDocument();
  const archiveContractMutation = useArchiveContractDocument();

  const [editMode, setEditMode] = useState(false);
  const [content, setContent] = useState('');
  const [name, setName] = useState('');

  const handleEdit = () => {
    setContent(contract.content);
    setName(contract.name);
    setEditMode(true);
  };

  const handleSave = async () => {
    try {
      // Valida se é um JSON válido antes de salvar
      JSON.parse(content);
      await updateContentMutation.mutateAsync({
        id: contract.id,
        data: { name, content },
      });
      toast.success('Conteúdo atualizado com sucesso!');
      setEditMode(false);
      router.refresh();
    } catch (error) {
      if (error instanceof SyntaxError) {
        toast.error('JSON inválido! Verifique a sintaxe.');
      } else {
        toast.error('Erro ao atualizar conteúdo');
      }
    }
  };

  const handleSend = async () => {
    try {
      await sendContractMutation.mutateAsync(contract.id);
      toast.success('Contrato enviado com sucesso!');
      router.refresh();
    } catch (error) {
      toast.error('Erro ao enviar contrato');
    }
  };

  const handleAccept = async () => {
    try {
      await acceptContractMutation.mutateAsync(contract.id);
      toast.success('Contrato aceito com sucesso!');
      router.refresh();
    } catch (error) {
      toast.error('Erro ao aceitar contrato');
    }
  };

  const handleArchive = async () => {
    try {
      await archiveContractMutation.mutateAsync(contract.id);
      toast.success('Contrato arquivado com sucesso!');
      router.refresh();
    } catch (error) {
      toast.error('Erro ao arquivar contrato');
    }
  };

  const isDraft = contract.status === 'DRAFT';
  const isSent = contract.status === 'SENT';

  return (
    <Container>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => router.back()}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">{contract.name}</h1>
              <p className="text-sm text-muted-foreground">
                Versão {contract.version}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Badge className={ContractStatusColors[contract.status]}>
              {contract.status}
            </Badge>
          </div>
        </div>

        {/* Info Card */}
        <Card>
          <CardHeader>
            <CardTitle>Informações</CardTitle>
            <CardDescription>Detalhes do contrato</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-muted-foreground">ID</Label>
                <p className="font-mono text-sm">{contract.id}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Projeto</Label>
                <p className="font-mono text-sm">{contract.projectId}</p>
              </div>
              {contract.proposalId && (
                <div>
                  <Label className="text-muted-foreground">Proposta</Label>
                  <p className="font-mono text-sm">{contract.proposalId}</p>
                </div>
              )}
              <div>
                <Label className="text-muted-foreground">Status</Label>
                <p className="font-medium">{contract.status}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Criado em</Label>
                <p>{new Date(contract.createdAt).toLocaleString('pt-BR')}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Atualizado em</Label>
                <p>{new Date(contract.updatedAt).toLocaleString('pt-BR')}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Content Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Conteúdo</CardTitle>
                <CardDescription>
                  Conteúdo do contrato em formato JSON
                </CardDescription>
              </div>
              {isDraft && !editMode && (
                <Button onClick={handleEdit} size="sm">
                  <Edit className="h-4 w-4 mr-2" />
                  Editar
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {editMode ? (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="name">Nome</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Nome do contrato"
                  />
                </div>
                <div>
                  <Label htmlFor="content">Conteúdo JSON</Label>
                  <Textarea
                    id="content"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Digite o conteúdo JSON"
                    className="font-mono min-h-[400px]"
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleSave}>
                    <Save className="h-4 w-4 mr-2" />
                    Salvar
                  </Button>
                  <Button variant="outline" onClick={() => setEditMode(false)}>
                    <X className="h-4 w-4 mr-2" />
                    Cancelar
                  </Button>
                </div>
              </div>
            ) : (
              <div>
                <pre className="bg-muted p-4 rounded-lg overflow-auto">
                  <code className="text-sm">
                    {JSON.stringify(JSON.parse(contract.content), null, 2)}
                  </code>
                </pre>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Ações</CardTitle>
            <CardDescription>Operações disponíveis</CardDescription>
          </CardHeader>
          <CardContent className="flex gap-2">
            {isDraft && (
              <Button onClick={handleSend}>
                <Send className="h-4 w-4 mr-2" />
                Enviar Contrato
              </Button>
            )}
            {isSent && (
              <Button onClick={handleAccept}>
                <CheckCircle className="h-4 w-4 mr-2" />
                Aceitar Contrato
              </Button>
            )}
            <Button variant="outline" onClick={handleArchive}>
              <Archive className="h-4 w-4 mr-2" />
              Arquivar
            </Button>
          </CardContent>
        </Card>
      </div>
    </Container>
  );
}
