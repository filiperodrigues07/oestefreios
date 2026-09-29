/**
 * Espelha backend/src/types/auth.types.ts. Duplicado porque o monorepo tem
 * só 2 workspaces (backend/frontend), sem workspace `shared/` — decisão do
 * usuário, não reaberta. Ao adicionar/remover uma permissão, atualize os dois arquivos.
 */
export const PERMISSIONS = [
  'OS_VIEW',
  'OS_CREATE',
  'OS_EDIT',
  'OS_DELETE',
  'OS_CHANGE_STATUS',
  'OS_REOPEN',
  'OS_VIEW_FINALIZADAS',
  'CLIENT_DELETE',
  'VEHICLE_DELETE',

  'PRODUCT_VIEW',
  'PRODUCT_SEARCH',
  'PRODUCT_ADD_TO_OS',

  'SERVICE_VIEW',
  'SERVICE_SEARCH',
  'SERVICE_ADD_TO_OS',

  'FINANCIAL_VIEW',
  'FINANCIAL_EDIT',

  'USER_VIEW',
  'USER_CREATE',
  'USER_EDIT',
  'USER_DELETE',

  'REPORT_VIEW',
  'SYSTEM_SETTINGS',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  photoUrl: string | null;
  roleId: string;
  roleName: string;
  permissions: Permission[];
  mustChangePassword: boolean;
  cherpUsuarioChave?: number;
  osStatusFixo: number | null;
  osSituacaoAtendimentoFixa: string | null;
  /** Só para montar o menu do proprietário; a autorização real é sempre no servidor. */
  isSuperAdmin: boolean;
}

export interface LoginResponse {
  accessToken: string;
  user: AuthUser;
}

/** Rótulo amigável de cada permissão — só usado na matriz de Usuários e Permissões (Fase G). */
export const PERMISSION_LABELS: Record<Permission, string> = {
  OS_VIEW: 'Visualizar OS',
  OS_CREATE: 'Criar OS e cadastrar clientes e veículos',
  OS_EDIT: 'Editar OS e cadastros de clientes e veículos',
  OS_DELETE: 'Excluir OS',
  CLIENT_DELETE: 'Excluir clientes',
  VEHICLE_DELETE: 'Excluir veículos',
  OS_CHANGE_STATUS: 'Alterar status da OS',
  OS_REOPEN: 'Reabrir OS finalizada',
  OS_VIEW_FINALIZADAS: 'Ver OS finalizadas nas listas',
  PRODUCT_VIEW: 'Visualizar produtos',
  PRODUCT_SEARCH: 'Buscar produtos',
  PRODUCT_ADD_TO_OS: 'Adicionar produtos à OS',
  SERVICE_VIEW: 'Visualizar serviços',
  SERVICE_SEARCH: 'Buscar serviços',
  SERVICE_ADD_TO_OS: 'Adicionar serviços à OS',
  FINANCIAL_VIEW: 'Ver valores financeiros',
  FINANCIAL_EDIT: 'Editar valores financeiros',
  USER_VIEW: 'Visualizar usuários',
  USER_CREATE: 'Criar usuários',
  USER_EDIT: 'Editar usuários',
  USER_DELETE: 'Excluir usuários',
  REPORT_VIEW: 'Ver dashboard/relatórios',
  SYSTEM_SETTINGS: 'Configurações do sistema',
};

/**
 * O que cada permissão libera na prática, em linguagem de balcão. Confira em routes/*.ts e services/*
 * ao mudar: texto desatualizado aqui faz o gerente dar acesso sem saber o que está dando.
 */
export const PERMISSION_HELP: Record<Permission, string> = {
  OS_VIEW: 'Abre a lista e os detalhes das OS, e as telas de Clientes e Veículos (só consulta). É a base de todo o resto.',
  OS_CREATE: 'Abre OS nova, duplica OS e cadastra clientes e veículos (com consulta de placa).',
  OS_EDIT: 'Altera dados da OS (problema, KM, diagnóstico, prioridade), fotos e o cadastro de clientes e veículos. Não vale para OS finalizada.',
  OS_DELETE: 'Exclui uma OS que ainda está em aberto (pede o motivo). OS finalizada não pode ser excluída.',
  OS_CHANGE_STATUS: 'Muda a situação do atendimento, finaliza a OS e envia a OS ao cliente por WhatsApp ou e-mail.',
  OS_REOPEN: 'Volta uma OS finalizada no app para "Em atendimento" (pede o motivo). Não reabre OS que já virou pedido ou nota no CHERP.',
  OS_VIEW_FINALIZADAS: 'Mostra nas listas, no painel e na busca as OS já finalizadas no app. Sem esta elas somem (o link direto ainda abre, só leitura).',
  CLIENT_DELETE: 'Exclui o cadastro de um cliente.',
  VEHICLE_DELETE: 'Exclui o cadastro de um veículo.',
  PRODUCT_VIEW: 'Abre a tela de Produtos (consulta e relatório do catálogo) e a busca de produtos dentro da OS. Necessária para lançar produto.',
  PRODUCT_SEARCH: 'Inclui produtos nos resultados da busca geral do sistema (Ctrl+K).',
  PRODUCT_ADD_TO_OS: 'Lança, muda a quantidade e remove produtos da OS. Junto com "Visualizar produtos".',
  SERVICE_VIEW: 'Abre a tela de Serviços (consulta e relatório do catálogo) e a busca de serviços dentro da OS. Necessária para lançar serviço.',
  SERVICE_SEARCH: 'Inclui serviços nos resultados da busca geral do sistema (Ctrl+K).',
  SERVICE_ADD_TO_OS: 'Lança, muda a quantidade e remove serviços da OS. Junto com "Visualizar serviços".',
  FINANCIAL_VIEW: 'Mostra preços, totais e valores (OS, catálogo e painel). Sem esta, tudo isso fica oculto e o resumo financeiro não pode ser enviado.',
  FINANCIAL_EDIT: 'Permite mudar o preço de um item ao lançar na OS. Sem esta, vale sempre o preço do cadastro.',
  USER_VIEW: 'Abre a tela de Usuários para consultar e exportar a lista. Não altera nada.',
  USER_CREATE: 'Cadastra usuários novos e envia o convite para definirem a senha.',
  USER_EDIT: 'Altera nome, e-mail, perfil, permissões e situação (ativo/inativo) dos usuários.',
  USER_DELETE: 'Exclui usuários.',
  REPORT_VIEW: 'Abre o painel (dashboard) e a tela de Relatórios, inclusive o ranking de vendas.',
  SYSTEM_SETTINGS: 'Abre Configurações (empresa, WhatsApp, e-mail...) e a Auditoria. Só o perfil Administrador pode receber.',
};

/** Agrupamento por categoria pra matriz de permissões (item 5 da rodada de melhorias). */
export const PERMISSION_GROUPS: { label: string; permissions: Permission[] }[] = [
  { label: 'Ordens de Serviço', permissions: ['OS_VIEW', 'OS_CREATE', 'OS_EDIT', 'OS_DELETE', 'OS_CHANGE_STATUS', 'OS_REOPEN', 'OS_VIEW_FINALIZADAS'] },
  { label: 'Cadastros', permissions: ['CLIENT_DELETE', 'VEHICLE_DELETE'] },
  { label: 'Produtos', permissions: ['PRODUCT_VIEW', 'PRODUCT_SEARCH', 'PRODUCT_ADD_TO_OS'] },
  { label: 'Serviços', permissions: ['SERVICE_VIEW', 'SERVICE_SEARCH', 'SERVICE_ADD_TO_OS'] },
  { label: 'Financeiro', permissions: ['FINANCIAL_VIEW', 'FINANCIAL_EDIT'] },
  { label: 'Usuários', permissions: ['USER_VIEW', 'USER_CREATE', 'USER_EDIT', 'USER_DELETE'] },
  { label: 'Relatórios e Sistema', permissions: ['REPORT_VIEW', 'SYSTEM_SETTINGS'] },
];
