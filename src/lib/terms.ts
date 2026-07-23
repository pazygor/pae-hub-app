import { AppUser } from './types';

/**
 * Termo de Consentimento de Uso (item 6). Texto e versão vivem AQUI, num lugar só.
 * Para atualizar o termo: edite `TERMS_TEXT` e suba `TERMS_VERSION` — todos os
 * usuários são re-perguntados no próximo acesso (o aceite antigo permanece no log).
 */
export const TERMS_VERSION = '1.0';

export const TERMS_TITLE = 'Termo de Consentimento de Uso – PAE Hub';

/** Parágrafos do termo (renderizados um a um pelo modal). */
export const TERMS_TEXT: string[] = [
  'Bem-vindo ao PAE Hub.',
  'O PAE Hub é uma plataforma desenvolvida para apoiar a gestão de emergências, a coordenação operacional, a comunicação entre equipes e a gestão de processos das organizações que a utilizam. Em razão da natureza das informações tratadas e da importância da plataforma para a tomada de decisões, é fundamental que sua utilização ocorra de forma responsável, segura e em conformidade com as normas aplicáveis.',
  'Ao acessar o sistema pela primeira vez, você declara que leu, compreendeu e concorda com as condições estabelecidas neste Termo de Consentimento de Uso.',
  'O acesso ao PAE Hub é concedido exclusivamente a usuários devidamente autorizados. Suas credenciais são pessoais, individuais e intransferíveis, sendo de sua responsabilidade mantê-las em sigilo. Toda informação registrada na plataforma deve refletir a realidade dos fatos, contribuindo para uma gestão eficiente, confiável e segura das operações, especialmente em situações de emergência.',
  'Para garantir a integridade das informações, a rastreabilidade das operações e a continuidade dos serviços, o PAE Hub registra eventos de acesso e utilização por meio de mecanismos de auditoria (logs), podendo armazenar informações como identificação do usuário, data e hora de acesso, endereço IP, dispositivo utilizado e demais registros necessários à segurança da informação, auditoria, suporte técnico, prevenção de incidentes e cumprimento de obrigações legais e contratuais.',
  'Os dados pessoais eventualmente tratados pela plataforma serão utilizados exclusivamente para finalidades legítimas relacionadas à autenticação, operação, comunicação, gestão de emergências, suporte, auditoria, segurança da informação e atendimento à Lei Geral de Proteção de Dados Pessoais (Lei nº 13.709/2018 – LGPD), sendo adotadas medidas técnicas e administrativas para sua proteção.',
  'A utilização indevida da plataforma, o compartilhamento de credenciais, a inserção de informações falsas, a tentativa de acesso não autorizado ou qualquer conduta que comprometa a segurança, a disponibilidade ou a confiabilidade do PAE Hub poderá resultar na suspensão ou revogação do acesso, sem prejuízo das medidas administrativas, contratuais e legais cabíveis.',
  'Ao selecionar "Aceito", você declara que leu, compreendeu e concorda integralmente com este Termo de Consentimento de Uso, comprometendo-se a utilizar o PAE Hub de forma ética, responsável e segura, contribuindo para a confiabilidade das informações e para a eficiência das operações e da gestão de emergências.',
];

/** Assinatura institucional exibida no rodapé do termo. */
export const TERMS_FOOTER = {
  brand: 'PAE Hub · M1',
  tagline: 'Tecnologia para uma gestão de emergências mais segura, integrada e confiável.',
};

/**
 * O usuário ainda precisa aceitar? (nunca aceitou OU aceitou uma versão anterior à atual).
 * Entidades também aceitam — é uso da plataforma por qualquer perfil.
 */
export function needsTermsAcceptance(user: Pick<AppUser, 'termsAcceptedAt' | 'termsVersion'> | null): boolean {
  if (!user) return false;
  return !user.termsAcceptedAt || user.termsVersion !== TERMS_VERSION;
}
