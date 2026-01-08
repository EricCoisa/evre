'use client';

import { useRouter } from 'next/navigation';
import { useUpdateProposalContent, useSendProposal } from '@/lib/actions/proposal/queries';
import { Container } from '@/components/container';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Send, Save, Eye, Code, FileText } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ProposalStatusColors, Proposal } from '@/lib/actions/proposal/types';
import { useState } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ProposalRenderer } from '@/app/proposal-public/components';

interface ProposalDetailClientProps {
  proposal: Proposal;
}

export function ProposalDetailClient({ proposal }: ProposalDetailClientProps) {
  const router = useRouter();
  const updateContentMutation = useUpdateProposalContent();
  const sendProposalMutation = useSendProposal();

  const [editMode, setEditMode] = useState(false);
  const [content, setContent] = useState('');
  const [name, setName] = useState('');

  const handleEdit = () => {
    setContent(proposal.content);
    setName(proposal.name);
    setEditMode(true);
  };

  const handleSave = async () => {
    try {
      // Valida se é um JSON válido antes de salvar
      JSON.parse(content);
      await updateContentMutation.mutateAsync({ id: proposal.id, data: { name, content } });
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
      await sendProposalMutation.mutateAsync(proposal.id);
      toast.success('Proposta enviada com sucesso!');
      router.refresh();
    } catch (error) {
      toast.error('Erro ao enviar proposta');
    }
  };

  const isDraft = proposal.status === 'DRAFT';

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
              <h1 className="text-2xl font-bold">{proposal.name}</h1>
              <p className="text-sm text-muted-foreground">ID: {proposal.id}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Badge className={ProposalStatusColors[proposal.status]}>
              {proposal.status}
            </Badge>
          </div>
        </div>

        {/* Info Card */}
        <Card>
          <CardHeader>
            <CardTitle>Informações</CardTitle>
            <CardDescription>Detalhes da proposta</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Nome</p>
                {editMode ? (
                  <input
                    type="text"
                    className="text-sm border rounded px-2 py-1 w-full"
                    value={name}
                    onChange={e => setName(e.target.value)}
                  />
                ) : (
                  <p className="text-sm">{proposal.name}</p>
                )}
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Empresa</p>
                <p className="text-sm">{proposal.companyId}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Versão</p>
                <p className="text-sm">{proposal.contentSchemaVersion}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Status</p>
                <Badge className={ProposalStatusColors[proposal.status]}>
                  {proposal.status}
                </Badge>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Criado em</p>
                <p className="text-sm">
                  {new Date(proposal.createdAt).toLocaleString('pt-BR')}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Atualizado em</p>
                <p className="text-sm">
                  {new Date(proposal.updatedAt).toLocaleString('pt-BR')}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Content Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Conteúdo da Proposta</CardTitle>
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
                  <label className="text-sm font-medium mb-2 block">
                    Nome da Proposta
                  </label>
                  <input
                    type="text"
                    className="text-sm border rounded px-2 py-1 w-full"
                    value={name}
                    onChange={e => setName(e.target.value)}
                  />
                </div>
                {/* Editor de JSON */}
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Editor JSON
                  </label>
                  <Textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    rows={20}
                    className="font-mono text-sm resize-y"
                    placeholder='{"version": "v1", "components": [{"object": "Title", "value": "Minha Proposta"}]}'
                  />
                </div>
                {/* Preview da Renderização */}
                <div>
                  {/* Aqui pode-se adicionar preview do conteúdo se necessário */}
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
                  <ProposalRenderer content={proposal.content} />
                </TabsContent>
                
                <TabsContent value="raw" className="mt-6">
                  <pre className="bg-muted p-4 rounded-lg overflow-auto max-h-96">
                    <code className="text-sm">
                      {JSON.stringify(JSON.parse(proposal.content), null, 2)}
                    </code>
                  </pre>
                </TabsContent>
              </Tabs>
            )}
          </CardContent>
        </Card>

        {/* Actions */}
        {isDraft && (
          <Card>
            <CardHeader>
              <CardTitle>Ações</CardTitle>
              <CardDescription>Ações disponíveis para esta proposta</CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={handleSend} disabled={sendProposalMutation.isPending}>
                <Send className="mr-2 h-4 w-4" />
                Enviar Proposta
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </Container>
  );
}
