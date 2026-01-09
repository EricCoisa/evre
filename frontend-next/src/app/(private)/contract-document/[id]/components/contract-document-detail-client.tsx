'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { 
  ArrowLeft, 
  Save, 
  Send, 
  CheckCircle, 
  Archive, 
  Eye, 
  Code, 
  FileText 
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { ContractDocument } from '@/lib/actions/contract-document/types';
import { ContractStatusColors } from '@/lib/actions/contract-document/types';
import {
  useUpdateContractDocumentContent,
  useSendContractDocument,
  useAcceptContractDocument,
  useArchiveContractDocument,
} from '@/lib/actions/contract-document/queries';
import { Container } from '@/components/container';
import { ContractRenderer } from '@/app/contract-public/components';

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
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (_error) {
      toast.error('Erro ao enviar contrato');
    }
  };

  const handleAccept = async () => {
    try {
      await acceptContractMutation.mutateAsync(contract.id);
      toast.success('Contrato aceito com sucesso!');
      router.refresh();
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (_error) {
      toast.error('Erro ao aceitar contrato');
    }
  };

  const handleArchive = async () => {
    try {
      await archiveContractMutation.mutateAsync(contract.id);
      toast.success('Contrato arquivado com sucesso!');
      router.refresh();
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (_error) {
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
                <CardTitle>Conteúdo do Contrato</CardTitle>
                <CardDescription>
                  {editMode ? 'Edite o JSON abaixo e visualize as mudanças em tempo real' : 'Visualize ou edite o conteúdo'}
                </CardDescription>
              </div>
              {isDraft && (
                <Button 
                  variant={editMode ? "default" : "outline"} 
                  size="sm" 
                  onClick={() => editMode ? setEditMode(false) : handleEdit()}
                >
                  <Code className="mr-2 h-4 w-4" />
                  {editMode ? 'Modo Visualização' : 'Editar JSON'}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {editMode ? (
              <div className="space-y-4">
                {/* Editor de Nome */}
                <div>
                  <Label htmlFor="name">Nome do Contrato</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Nome do contrato"
                    className="text-sm"
                  />
                </div>
                {/* Editor de JSON */}
                <div>
                  <Label htmlFor="content">Editor JSON</Label>
                  <Textarea
                    id="content"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    rows={20}
                    className="font-mono text-sm resize-y"
                    placeholder='{"version": "1.0", "components": [{"object": "Title", "value": "Contrato de Serviços"}]}'
                  />
                </div>
                {/* Botões de Ação */}
                <div className="flex gap-2 pt-4 border-t">
                  <Button onClick={handleSave} disabled={updateContentMutation.isPending}>
                    <Save className="mr-2 h-4 w-4" />
                    {updateContentMutation.isPending ? 'Salvando...' : 'Salvar Alterações'}
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setEditMode(false);
                      setContent('');
                    }}
                    disabled={updateContentMutation.isPending}
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            ) : (
              <Tabs defaultValue="preview" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="preview">
                    <Eye className="w-4 h-4 mr-2" />
                    Visualização
                  </TabsTrigger>
                  <TabsTrigger value="raw">
                    <FileText className="w-4 h-4 mr-2" />
                    JSON
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="preview" className="mt-6">
                  <ContractRenderer content={contract.content} />
                </TabsContent>
                
                <TabsContent value="raw" className="mt-6">
                  <pre className="bg-muted p-4 rounded-lg overflow-auto max-h-96">
                    <code className="text-sm">
                      {JSON.stringify(JSON.parse(contract.content), null, 2)}
                    </code>
                  </pre>
                </TabsContent>
              </Tabs>
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
