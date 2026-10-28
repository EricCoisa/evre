export interface ButtonEntry {
  /** ID do DOM associado ao botão (âncora `#hash` para scroll e destaque visual). */
  id: string;
  path: string;
  tab?: string;
  labelKey: string;
  labelNs: string;
  /** Feature flag que precisa estar ligada pra esse botão existir; ausente = sempre visível. */
  flag?: string;
  /** Nome do ícone do Lucide (compatível com `getIcon`). */
  icon?: string;
}

/** Registro de botões de ação da aplicação para busca e destaque visual. */
export const ButtonsList: ButtonEntry[] = [
  {
    id: 'btn-new-user',
    path: '/user',
    tab: 'users',
    labelKey: 'newUser',
    labelNs: 'users',
    icon: 'Plus',
  },
  {
    id: 'btn-new-invite',
    path: '/user',
    tab: 'invites',
    labelKey: 'newInvite',
    labelNs: 'users',
    icon: 'Mail',
  },
  {
    id: 'btn-new-contact',
    path: '/comunicacao',
    labelKey: 'newContact',
    labelNs: 'messaging',
    flag: 'MESSAGING_CONTACTS',
    icon: 'UserPlus',
  },
];

