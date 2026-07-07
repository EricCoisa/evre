  'use client';

  import { motion, useInView } from 'motion/react';
  import Image from 'next/image';
  import { EvreLogoAnimation } from '@/components/evre-logo-animation';
  import { Button } from '@/components/ui/button';
  import { ArrowRight, Code2, Layers, Zap } from 'lucide-react';
  import { GenericCreateForm } from '@/components/generic-create-form';
  import { z } from 'zod';
  import { createContact } from '@/lib/actions/contact/api';
  import { useMemo, useRef, useState } from 'react';
  import { FieldConfig } from '@/lib/form/field-config';
  import { toast } from 'sonner';
  import Modal from '@/components/modal';
  import backgroundData from '../../public/Grid Loop background.json';
import Lottie from 'lottie-react';

  // Componente de Seção com Animação Sutil
  function FadeIn({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
    const ref = useRef(null);
    const isInView = useInView(ref, { once: true, margin: "-80px" });

    return (
      <motion.div
        ref={ref}
        initial={{ opacity: 0, y: 24 }}
        animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 24 }}
        transition={{ duration: 0.5, delay, ease: [0.21, 0.47, 0.32, 0.98] }}
      >
        {children}
      </motion.div>
    );
  }

  export default function EvrePage() {
    const [ isContact, setContact ] = useState(false);
    // Schema e config do formulário de contato
    const contactSchema = z.object({
      name: z.string().min(2, 'Nome obrigatório').max(100, 'Nome muito longo'),
      email: z.string().email('E-mail inválido').max(100, 'E-mail muito longo'),
      telefone: z.string().min(6, 'Telefone obrigatório').max(30, 'Telefone muito longo'),
      text: z.string().min(1, 'Mensagem obrigatória').max(2000, 'Mensagem muito longa'),
    });

    const contactFieldConfig = useMemo(() => ({
      name: {
        label: 'Nome',
        placeholder: 'Seu nome',
        description: 'Como devemos te chamar?',
      },
      email: {
        label: 'E-mail',
        placeholder: 'seu@email.com',
        description: 'Para entrarmos em contato',
        type: 'email',
      },
      telefone: {
        label: 'Telefone',
        placeholder: '(99) 99999-9999',
        description: 'WhatsApp ou telefone',
      },
      text: {
        label: 'Mensagem',
        placeholder: 'Como podemos ajudar?',
        description: 'Conte um pouco sobre seu projeto ou dúvida',
        type: 'textarea',
      },
    } satisfies FieldConfig<typeof contactSchema>), []);


    return (
      <div className="min-h-screen bg-neutral-50 antialiased">

        {/* Hero Section */}
        <section className="relative border-b border-neutral-200 overflow-hidden">
          <div className="absolute inset-0 -z-10 pointer-events-none">
            <div
              style={{
                width: '100%',
                height: '100%',
                 background: 'linear-gradient(45deg, rgba(255,255,255,1) 0%, rgba(255,255,255,1) 20%, rgba(255,255,255,0) 20%, rgba(255,255,255,0) 100%)',
              }}
            >
              <Lottie
                animationData={backgroundData}
                loop={true}
                aria-label="EVRE"
                style={{ width: '100%', height: '100%' }}
              />
            </div>
          </div>
          <div className="max-w-6xl mx-auto px-6 lg:px-8 py-32 md:py-40 relative z-10">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <EvreLogoAnimation className="h-50 w-auto" />
          </div>

          <div className="max-w-3xl">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.21, 0.47, 0.32, 0.98] }}
            >
              <h1 className="text-5xl md:text-6xl lg:text-7xl font-medium text-neutral-900 leading-[1.1] tracking-tight mb-8">
                Software sob medida<br />para o seu negócio
              </h1>
            </motion.div>

            <motion.p
              className="text-xl md:text-2xl text-neutral-600 leading-relaxed mb-12 max-w-2xl"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1, ease: [0.21, 0.47, 0.32, 0.98] }}
            >
              Criamos sistemas robustos e escaláveis para startups, empresas de médio porte 
              e times que precisam transformar ideias em produtos reais.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2, ease: [0.21, 0.47, 0.32, 0.98] }}
            >
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <Button
                    onClick={() => setContact(true)}
                    size="lg"
                    className="text-base px-8 py-6 bg-neutral-900 hover:bg-neutral-800 text-white transition-all hover:shadow-lg"
                  >
                    Entrar em contato
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </motion.div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* Sobre a EVRE */}
        <section className="border-b border-neutral-200 bg-white">
          <div className="max-w-6xl mx-auto px-6 lg:px-8 py-24 md:py-32">
            <FadeIn>
              <div className="max-w-3xl mb-20">
                <h2 className="text-3xl md:text-4xl font-medium text-neutral-900 mb-6">
                Como trabalhamos
              </h2>
              <p className="text-lg text-neutral-600 leading-relaxed">
                Construímos software com processos claros, ciclos curtos e entregas frequentes. 
                Cada decisão técnica é fundamentada, cada entrega é validada.
              </p>
            </div>
          </FadeIn>

          <div className="grid md:grid-cols-3 gap-6">
            <FadeIn delay={0.1}>
              <motion.div
                className="bg-white border border-neutral-200 rounded-xl overflow-hidden hover:border-neutral-400 hover:shadow-lg transition-all duration-300"
                whileHover={{ y: -4 }}
              >
                {/* Simula barra de janela */}
                <div className="h-8 bg-neutral-100 border-b border-neutral-200 flex items-center px-3 gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-neutral-300"></div>
                  <div className="w-2.5 h-2.5 rounded-full bg-neutral-300"></div>
                  <div className="w-2.5 h-2.5 rounded-full bg-neutral-300"></div>
                </div>
                <div className="p-8">
                  <Code2 className="w-8 h-8 text-neutral-900 mb-4" />
                  <h3 className="text-xl font-medium text-neutral-900 mb-3">
                    Código interno
                  </h3>
                  <p className="text-neutral-600 leading-relaxed text-sm">
                    Todo o desenvolvimento é feito pela nossa equipe. Decisões técnicas 
                    são tomadas por quem escreve o código e entende o projeto.
                  </p>
                </div>
              </motion.div>
            </FadeIn>

            <FadeIn delay={0.2}>
              <motion.div
                className="bg-white border border-neutral-200 rounded-xl overflow-hidden hover:border-neutral-400 hover:shadow-lg transition-all duration-300"
                whileHover={{ y: -4 }}
              >
                <div className="h-8 bg-neutral-100 border-b border-neutral-200 flex items-center px-3 gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-neutral-300"></div>
                  <div className="w-2.5 h-2.5 rounded-full bg-neutral-300"></div>
                  <div className="w-2.5 h-2.5 rounded-full bg-neutral-300"></div>
                </div>
                <div className="p-8">
                  <Layers className="w-8 h-8 text-neutral-900 mb-4" />
                  <h3 className="text-xl font-medium text-neutral-900 mb-3">
                    Arquitetura sólida
                  </h3>
                  <p className="text-neutral-600 leading-relaxed text-sm">
                    Planejamos estrutura antes de codificar. Escolhemos tecnologias 
                    com critério e documentamos decisões importantes.
                  </p>
                </div>
              </motion.div>
            </FadeIn>

            <FadeIn delay={0.3}>
              <motion.div
                className="bg-white border border-neutral-200 rounded-xl overflow-hidden hover:border-neutral-400 hover:shadow-lg transition-all duration-300"
                whileHover={{ y: -4 }}
              >
                <div className="h-8 bg-neutral-100 border-b border-neutral-200 flex items-center px-3 gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-neutral-300"></div>
                  <div className="w-2.5 h-2.5 rounded-full bg-neutral-300"></div>
                  <div className="w-2.5 h-2.5 rounded-full bg-neutral-300"></div>
                </div>
                <div className="p-8">
                  <Zap className="w-8 h-8 text-neutral-900 mb-4" />
                  <h3 className="text-xl font-medium text-neutral-900 mb-3">
                    Stack moderna
                  </h3>
                  <p className="text-neutral-600 leading-relaxed text-sm">
                    TypeScript, React, Node.js, PostgreSQL, Tecnologias maduras, 
                    comunidade ativa, mercado consolidado.
                  </p>
                </div>
              </motion.div>
            </FadeIn>
          </div>
        </div>
      </section>

        {/* Serviços */}
        <section className="border-b border-neutral-200">
          <div className="max-w-6xl mx-auto px-6 lg:px-8 py-24 md:py-32">
            <FadeIn>
              <h2 className="text-3xl md:text-4xl font-medium text-neutral-900 mb-20">
                O que entregamos
              </h2>
            </FadeIn>

            <div className="grid md:grid-cols-3 gap-6">
              <FadeIn delay={0.1}>
                <motion.div
                className="bg-white border border-neutral-200 rounded-xl p-8 hover:border-neutral-900 hover:shadow-xl transition-all duration-300"
                whileHover={{ y: -6 }}
              >
                <div className="inline-flex items-center justify-center w-10 h-10 bg-neutral-900 text-white text-sm font-semibold rounded-lg mb-6">01</div>
                <h3 className="text-2xl font-medium text-neutral-900 mb-4">
                  Desenvolvimento web & mobile
                </h3>
                <p className="text-neutral-600 leading-relaxed mb-6">
                  Sistemas personalizados, plataformas internas, painéis administrativos 
                  e integrações complexas.
                </p>
                <div className="flex flex-wrap gap-2">
                  <span className="text-xs px-3 py-1 bg-neutral-100 text-neutral-700 rounded-full">Arquitetura escalável</span>
                  <span className="text-xs px-3 py-1 bg-neutral-100 text-neutral-700 rounded-full">Código documentado</span>
                  <span className="text-xs px-3 py-1 bg-neutral-100 text-neutral-700 rounded-full">Testes automatizados</span>
                </div>
              </motion.div>
            </FadeIn>

            <FadeIn delay={0.2}>
              <motion.div
                className="bg-white border border-neutral-200 rounded-xl p-8 hover:border-neutral-900 hover:shadow-xl transition-all duration-300"
                whileHover={{ y: -6 }}
              >
                <div className="inline-flex items-center justify-center w-10 h-10 bg-neutral-900 text-white text-sm font-semibold rounded-lg mb-6">02</div>
                <h3 className="text-2xl font-medium text-neutral-900 mb-4">
                  MVPs e validação
                </h3>
                <p className="text-neutral-600 leading-relaxed mb-6">
                  Teste sua ideia com usuários reais em semanas. Processos ágeis, 
                  escopo enxuto, entregas frequentes.
                </p>
                <div className="flex flex-wrap gap-2">
                  <span className="text-xs px-3 py-1 bg-neutral-100 text-neutral-700 rounded-full">Entrega rápida</span>
                  <span className="text-xs px-3 py-1 bg-neutral-100 text-neutral-700 rounded-full">Código escalável</span>
                  <span className="text-xs px-3 py-1 bg-neutral-100 text-neutral-700 rounded-full">Validação com usuários</span>
                </div>
              </motion.div>
            </FadeIn>

            <FadeIn delay={0.3}>
              <motion.div
                className="bg-white border border-neutral-200 rounded-xl p-8 hover:border-neutral-900 hover:shadow-xl transition-all duration-300"
                whileHover={{ y: -6 }}
              >
                <div className="inline-flex items-center justify-center w-10 h-10 bg-neutral-900 text-white text-sm font-semibold rounded-lg mb-6">03</div>
                <h3 className="text-2xl font-medium text-neutral-900 mb-4">
                  Manutenção e evolução
                </h3>
                <p className="text-neutral-600 leading-relaxed mb-6">
                  Assumimos projetos existentes, refatoramos código legado e oferecemos 
                  suporte contínuo.
                </p>
                <div className="flex flex-wrap gap-2">
                  <span className="text-xs px-3 py-1 bg-neutral-100 text-neutral-700 rounded-full">Suporte contínuo</span>
                  <span className="text-xs px-3 py-1 bg-neutral-100 text-neutral-700 rounded-full">Refatoração</span>
                  <span className="text-xs px-3 py-1 bg-neutral-100 text-neutral-700 rounded-full">Otimização</span>
                </div>
              </motion.div>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* Como Trabalhamos */}
      <section className="border-b border-neutral-200 bg-neutral-50">
        <div className="max-w-6xl mx-auto px-6 lg:px-8 py-24 md:py-32">
          <FadeIn>
            <h2 className="text-3xl md:text-4xl font-medium text-neutral-900 mb-20">
              Nosso processo
            </h2>
          </FadeIn>

            <div className="grid md:grid-cols-2 gap-6">
              <FadeIn delay={0.1}>
                <motion.div
                  className="bg-white border border-neutral-200 rounded-xl p-8 hover:border-neutral-300 hover:shadow-lg transition-all duration-300"
                  whileHover={{ x: 4 }}
                >
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-8 h-8 bg-neutral-900 rounded-lg flex items-center justify-center text-white font-medium text-xs">
                      01
                    </div>
                    <h3 className="text-xl font-medium text-neutral-900">
                      Entendimento e escopo
                    </h3>
                  </div>
                  <p className="text-neutral-600 leading-relaxed">
                    Definimos o problema, o objetivo e as métricas de sucesso. 
                    Escopo realista, prazos honestos.
                  </p>
                </motion.div>
              </FadeIn>

              <FadeIn delay={0.2}>
                <motion.div
                  className="bg-white border border-neutral-200 rounded-xl p-8 hover:border-neutral-300 hover:shadow-lg transition-all duration-300"
                  whileHover={{ x: 4 }}
                >
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-8 h-8 bg-neutral-900 rounded-lg flex items-center justify-center text-white font-medium text-xs">
                      02
                    </div>
                    <h3 className="text-xl font-medium text-neutral-900">
                      Arquitetura e planejamento
                    </h3>
                  </div>
                  <p className="text-neutral-600 leading-relaxed">
                    Desenhamos a estrutura antes de codificar. Tecnologias, integrações, 
                    deploy e escalabilidade são validados antes do início.
                  </p>
                </motion.div>
              </FadeIn>

              <FadeIn delay={0.3}>
                <motion.div
                  className="bg-white border border-neutral-200 rounded-xl p-8 hover:border-neutral-300 hover:shadow-lg transition-all duration-300"
                  whileHover={{ x: 4 }}
                >
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-8 h-8 bg-neutral-900 rounded-lg flex items-center justify-center text-white font-medium text-xs">
                      03
                    </div>
                    <h3 className="text-xl font-medium text-neutral-900">
                      Ciclos curtos de desenvolvimento
                    </h3>
                  </div>
                  <p className="text-neutral-600 leading-relaxed">
                    Sprints de 1-2 semanas. Progresso em tempo real, testes contínuos 
                    e feedback constante.
                  </p>
                </motion.div>
              </FadeIn>

              <FadeIn delay={0.4}>
                <motion.div
                  className="bg-white border border-neutral-200 rounded-xl p-8 hover:border-neutral-300 hover:shadow-lg transition-all duration-300"
                  whileHover={{ x: 4 }}
                >
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-8 h-8 bg-neutral-900 rounded-lg flex items-center justify-center text-white font-medium text-xs">
                      04
                    </div>
                    <h3 className="text-xl font-medium text-neutral-900">
                      Deploy e evolução
                    </h3>
                  </div>
                  <p className="text-neutral-600 leading-relaxed">
                    Após o lançamento, monitoramos e ajustamos o sistema. 
                    Suporte pontual ou parceria contínua.
                  </p>
                </motion.div>
              </FadeIn>
            </div>
          </div>
        </section>

        {/* Cases / Social Proof */}
        <section className="border-b border-neutral-200 bg-white">
          <div className="max-w-6xl mx-auto px-6 lg:px-8 py-24 md:py-32">
            <FadeIn>
              <div className="max-w-3xl">
                <h2 className="text-3xl md:text-4xl font-medium text-neutral-900 mb-12">
                  Já ajudamos times a lançar produtos, validar MVPs e escalar plataformas
                </h2>
                <p className="text-lg text-neutral-600 leading-relaxed mb-12">
                  Trabalhamos com startups em estágio inicial, empresas de médio porte e times internos
                  que precisam de reforço técnico. Cada projeto é diferente — mas a abordagem é a mesma:
                  clareza, código sólido e entregas consistentes.
                </p>
                <div className="flex items-center gap-12 text-sm text-neutral-500">
                  <div>
                    <div className="text-3xl font-medium text-neutral-900 mb-2">30+</div>
                    <div>Projetos entregues</div>
                  </div>
                  <div>
                    <div className="text-3xl font-medium text-neutral-900 mb-2">100%</div>
                    <div>Código próprio</div>
                  </div>

                </div>
              </div>
            </FadeIn>
          </div>
        </section>

        {/* CTA Final */}
        <section className="bg-neutral-900 text-white">
          <div className="max-w-6xl mx-auto px-6 lg:px-8 py-24 md:py-32">
            <FadeIn>
              <div className="max-w-2xl">
                <h2 className="text-3xl md:text-4xl font-medium mb-8">
                  Vamos conversar sobre o seu projeto
                </h2>

                <p className="text-xl text-neutral-400 leading-relaxed mb-12">
                  Agende 30 minutos com a gente. Sem compromisso, sem discurso de vendas.
                  Só uma conversa direta sobre o que você precisa construir.
                </p>

                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <Button
                    onClick={() => setContact(true)}
                    size="lg"
                    className="text-base px-8 py-6 bg-white hover:bg-neutral-100 text-neutral-900 transition-all hover:shadow-xl mb-6"
                  >
                    Entrar em contato
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </motion.div>
              </div>
            </FadeIn>
          </div>
        </section>

        {/* Footer */}
        <footer className="bg-neutral-900 border-t border-neutral-800 text-neutral-500">
          <div className="max-w-6xl mx-auto px-6 lg:px-8 py-12">
            <div className="grid md:grid-cols-3 gap-12 mb-12">
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-lg font-medium text-white">EVRE</span>
                </div>
                <p className="text-sm leading-relaxed">
                  Fábrica de software sob medida
                </p>
              </div>

              <div>
                <h4 className="text-sm font-medium text-white mb-4">Serviços</h4>
                <ul className="space-y-2 text-sm">
                  <li><a href="/servicos" className="hover:text-white transition-colors">Desenvolvimento web</a></li>
                  <li><a href="/mvps" className="hover:text-white transition-colors">MVPs</a></li>
                  <li><a href="/manutencao" className="hover:text-white transition-colors">Manutenção</a></li>
                </ul>
              </div>

              <div>
                <h4 className="text-sm font-medium text-white mb-4">Empresa</h4>
                <ul className="space-y-2 text-sm">
                  <li><a href="/sobre" className="hover:text-white transition-colors">Sobre nós</a></li>
                  <li><a href="/processo" className="hover:text-white transition-colors">Nosso processo</a></li>
                  <li><a href="/contato" className="hover:text-white transition-colors">Contato</a></li>
                </ul>
              </div>
            </div>

            <div className="border-t border-neutral-800 pt-8 text-sm text-center">
              <p>© 2026 EVRE — Todos os direitos reservados</p>
            </div>
          </div>
        </footer>
        <Modal
          open={isContact}
          onOpenChange={(open) => {
            setContact(open);
          }}
          title="Entrar em contato"
          description="Conte um pouco sobre seu projeto ou envie uma dúvida. Retornamos em até 24h."
        >
          <GenericCreateForm
            schema={contactSchema}
            fieldConfig={contactFieldConfig}
            submitLabel="Enviar mensagem"
            onCancel={()=>{
              setContact(false);
            }}
            onSubmit={async (data) => {
              return await createContact(data);
            }}
            onSuccess={() => {
              setContact(false);
              toast("Mensagem enviada!")
            }}
          />
        </Modal>
      </div>
    );
  }
