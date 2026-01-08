'use client';

import { motion, useInView } from 'motion/react';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';
import { useRef } from 'react';

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
  return (
    <div className="min-h-screen bg-neutral-50 antialiased">
      
      {/* Hero Section */}
      <section className="border-b border-neutral-200">
        <div className="max-w-6xl mx-auto px-6 lg:px-8 py-32 md:py-40">
          <div className="max-w-3xl">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.21, 0.47, 0.32, 0.98] }}
            >
              <h1 className="text-5xl md:text-6xl lg:text-7xl font-medium text-neutral-900 leading-[1.1] tracking-tight mb-8">
                Desenvolvemos software<br />sob medida para o<br />seu negócio
              </h1>
            </motion.div>
            
            <motion.p 
              className="text-xl md:text-2xl text-neutral-600 leading-relaxed mb-12 max-w-2xl"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1, ease: [0.21, 0.47, 0.32, 0.98] }}
            >
              Somos uma fábrica de software focada em criar sistemas robustos, escaláveis e fáceis de manter. 
              Trabalhamos com startups, empresas de médio porte e times que precisam tirar ideias do papel.
            </motion.p>
            
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2, ease: [0.21, 0.47, 0.32, 0.98] }}
            >
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Button 
                  size="lg" 
                  className="text-base px-8 py-6 bg-neutral-900 hover:bg-neutral-800 text-white transition-all hover:shadow-lg"
                >
                  Agendar uma conversa
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </motion.div>
              
              <p className="text-sm text-neutral-500 mt-4">
                Respondemos em até 24 horas
              </p>
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
                Não trabalhamos com teatro ágil ou promessas vazias
              </h2>
              <p className="text-lg text-neutral-600 leading-relaxed">
                Construímos software que resolve problemas reais. Não vendemos buzzwords — 
                vendemos código limpo, arquitetura sólida e entregas consistentes.
              </p>
            </div>
          </FadeIn>

          <div className="grid md:grid-cols-3 gap-6">
            <FadeIn delay={0.1}>
              <motion.div 
                className="bg-neutral-50 border border-neutral-200 rounded-2xl p-8 hover:bg-white hover:border-neutral-300 hover:shadow-lg transition-all duration-300"
                whileHover={{ y: -4 }}
              >
                <div className="w-12 h-12 bg-neutral-900 rounded-xl flex items-center justify-center mb-6">
                  <div className="text-white text-xl font-bold">01</div>
                </div>
                <h3 className="text-xl font-medium text-neutral-900 mb-4">
                  Como pensamos
                </h3>
                <p className="text-neutral-600 leading-relaxed">
                  Software é investimento, não custo. Acreditamos em ciclos curtos, 
                  feedback constante e evolução incremental. Nada de big bang.
                </p>
              </motion.div>
            </FadeIn>

            <FadeIn delay={0.2}>
              <motion.div 
                className="bg-neutral-50 border border-neutral-200 rounded-2xl p-8 hover:bg-white hover:border-neutral-300 hover:shadow-lg transition-all duration-300"
                whileHover={{ y: -4 }}
              >
                <div className="w-12 h-12 bg-neutral-900 rounded-xl flex items-center justify-center mb-6">
                  <div className="text-white text-xl font-bold">02</div>
                </div>
                <h3 className="text-xl font-medium text-neutral-900 mb-4">
                  O que nos diferencia
                </h3>
                <p className="text-neutral-600 leading-relaxed">
                  Não terceirizamos a cabeça. Todo código sai daqui. Todo questionamento técnico 
                  é respondido por quem está no projeto.
                </p>
              </motion.div>
            </FadeIn>

            <FadeIn delay={0.3}>
              <motion.div 
                className="bg-neutral-50 border border-neutral-200 rounded-2xl p-8 hover:bg-white hover:border-neutral-300 hover:shadow-lg transition-all duration-300"
                whileHover={{ y: -4 }}
              >
                <div className="w-12 h-12 bg-neutral-900 rounded-xl flex items-center justify-center mb-6">
                  <div className="text-white text-xl font-bold">03</div>
                </div>
                <h3 className="text-xl font-medium text-neutral-900 mb-4">
                  Stack principal
                </h3>
                <p className="text-neutral-600 leading-relaxed">
                  TypeScript, React, Node.js, PostgreSQL, AWS. Tecnologias maduras, comunidade ativa, mercado consolidado.
                </p>
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
                className="bg-white border border-neutral-200 rounded-2xl p-8 hover:border-neutral-900 hover:shadow-xl transition-all duration-300 group"
                whileHover={{ y: -6 }}
              >
                <div className="text-5xl font-bold text-neutral-200 group-hover:text-neutral-300 transition-colors mb-6">01</div>
                <h3 className="text-2xl font-medium text-neutral-900 mb-4">
                  Desenvolvimento web & mobile
                </h3>
                <p className="text-neutral-600 leading-relaxed mb-6">
                  Sistemas personalizados, plataformas internas, painéis administrativos, 
                  integrações complexas.
                </p>
                <p className="text-sm text-neutral-500">
                  Arquitetura escalável · Código documentado · Testes automatizados
                </p>
              </motion.div>
            </FadeIn>

            <FadeIn delay={0.2}>
              <motion.div 
                className="bg-white border border-neutral-200 rounded-2xl p-8 hover:border-neutral-900 hover:shadow-xl transition-all duration-300 group"
                whileHover={{ y: -6 }}
              >
                <div className="text-5xl font-bold text-neutral-200 group-hover:text-neutral-300 transition-colors mb-6">02</div>
                <h3 className="text-2xl font-medium text-neutral-900 mb-4">
                  MVPs e validação rápida
                </h3>
                <p className="text-neutral-600 leading-relaxed mb-6">
                  Precisa testar uma ideia com usuários reais em semanas, não meses? 
                  A gente já fez isso dezenas de vezes.
                </p>
                <p className="text-sm text-neutral-500">
                  Entrega rápida · Código escalável · Validação com usuários
                </p>
              </motion.div>
            </FadeIn>

            <FadeIn delay={0.3}>
              <motion.div 
                className="bg-white border border-neutral-200 rounded-2xl p-8 hover:border-neutral-900 hover:shadow-xl transition-all duration-300 group"
                whileHover={{ y: -6 }}
              >
                <div className="text-5xl font-bold text-neutral-200 group-hover:text-neutral-300 transition-colors mb-6">03</div>
                <h3 className="text-2xl font-medium text-neutral-900 mb-4">
                  Manutenção e evolução
                </h3>
                <p className="text-neutral-600 leading-relaxed mb-6">
                  Software não é projeto — é produto. Assumimos projetos legados, 
                  refatoramos código antigo e oferecemos suporte contínuo.
                </p>
                <p className="text-sm text-neutral-500">
                  Suporte contínuo · Refatoração · Otimização de performance
                </p>
              </motion.div>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* Como Trabalhamos */}
      <section className="border-b border-neutral-200">
        <div className="max-w-6xl mx-auto px-6 lg:px-8 py-24 md:py-32">
          <FadeIn>
            <h2 className="text-3xl md:text-4xl font-medium text-neutral-900 mb-20">
              Como trabalhamos
            </h2>
          </FadeIn>

          <div className="grid md:grid-cols-2 gap-6">
            <FadeIn delay={0.1}>
              <motion.div 
                className="bg-white border border-neutral-200 rounded-2xl p-8 hover:border-neutral-300 hover:shadow-lg transition-all duration-300"
                whileHover={{ x: 4 }}
              >
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-10 h-10 bg-neutral-900 rounded-lg flex items-center justify-center text-white font-medium text-sm">
                    01
                  </div>
                  <h3 className="text-xl font-medium text-neutral-900">
                    Entendimento e escopo
                  </h3>
                </div>
                <p className="text-neutral-600 leading-relaxed">
                  Primeiro, a gente precisa entender o problema de verdade. Não só o que você quer 
                  construir — por que você quer construir. Definimos escopo realista, prazos honestos 
                  e métricas de sucesso.
                </p>
              </motion.div>
            </FadeIn>

            <FadeIn delay={0.2}>
              <motion.div 
                className="bg-white border border-neutral-200 rounded-2xl p-8 hover:border-neutral-300 hover:shadow-lg transition-all duration-300"
                whileHover={{ x: 4 }}
              >
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-10 h-10 bg-neutral-900 rounded-lg flex items-center justify-center text-white font-medium text-sm">
                    02
                  </div>
                  <h3 className="text-xl font-medium text-neutral-900">
                    Arquitetura e planejamento técnico
                  </h3>
                </div>
                <p className="text-neutral-600 leading-relaxed">
                  Antes de escrever código, desenhamos a estrutura. Escolhemos tecnologias, 
                  definimos integrações, planejamos deploy e escalabilidade. Você valida tudo 
                  antes de começar.
                </p>
              </motion.div>
            </FadeIn>

            <FadeIn delay={0.3}>
              <motion.div 
                className="bg-white border border-neutral-200 rounded-2xl p-8 hover:border-neutral-300 hover:shadow-lg transition-all duration-300"
                whileHover={{ x: 4 }}
              >
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-10 h-10 bg-neutral-900 rounded-lg flex items-center justify-center text-white font-medium text-sm">
                    03
                  </div>
                  <h3 className="text-xl font-medium text-neutral-900">
                    Desenvolvimento em ciclos curtos
                  </h3>
                </div>
                <p className="text-neutral-600 leading-relaxed">
                  Trabalhamos em sprints de 1-2 semanas. Você acompanha o progresso em tempo real, 
                  testa funcionalidades prontas e dá feedback constante. Sem caixas-pretas.
                </p>
              </motion.div>
            </FadeIn>

            <FadeIn delay={0.4}>
              <motion.div 
                className="bg-white border border-neutral-200 rounded-2xl p-8 hover:border-neutral-300 hover:shadow-lg transition-all duration-300"
                whileHover={{ x: 4 }}
              >
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-10 h-10 bg-neutral-900 rounded-lg flex items-center justify-center text-white font-medium text-sm">
                    04
                  </div>
                  <h3 className="text-xl font-medium text-neutral-900">
                    Deploy e evolução contínua
                  </h3>
                </div>
                <p className="text-neutral-600 leading-relaxed">
                  Depois do go-live, o trabalho não acaba. Monitoramos, ajustamos, evoluímos. 
                  Você decide se quer suporte pontual ou uma parceria contínua.
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
                  size="lg" 
                  className="text-base px-8 py-6 bg-white hover:bg-neutral-100 text-neutral-900 transition-all hover:shadow-xl mb-6"
                >
                  Agendar conversa
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </motion.div>

              <p className="text-sm text-neutral-500">
                Ou mande um e-mail direto:{' '}
                <a href="mailto:contato@evre.com.br" className="text-white hover:text-neutral-300 underline transition-colors">
                  contato@evre.com.br
                </a>
              </p>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-neutral-900 border-t border-neutral-800 text-neutral-500">
        <div className="max-w-6xl mx-auto px-6 lg:px-8 py-12">
          <div className="grid md:grid-cols-4 gap-12 mb-12">
            <div>
              <div className="text-lg font-medium text-white mb-4">EVRE</div>
              <p className="text-sm leading-relaxed">
                Fábrica de software sob medida
              </p>
            </div>
            
            <div>
              <h4 className="text-sm font-medium text-white mb-4">Serviços</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-white transition-colors">Desenvolvimento web</a></li>
                <li><a href="#" className="hover:text-white transition-colors">MVPs</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Manutenção</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="text-sm font-medium text-white mb-4">Empresa</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-white transition-colors">Sobre nós</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Como trabalhamos</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Contato</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="text-sm font-medium text-white mb-4">Contato</h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <a href="mailto:contato@evre.com.br" className="hover:text-white transition-colors">
                    contato@evre.com.br
                  </a>
                </li>
                <li>
                  <a href="https://linkedin.com" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
                    LinkedIn
                  </a>
                </li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-neutral-800 pt-8 text-sm text-center">
            <p>© 2026 EVRE — Todos os direitos reservados</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
