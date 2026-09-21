export interface ErrorPresentation {
  code: string;
  title: string;
  description: string;
  recovery: 'retry' | 'login' | 'home';
}

const messages: Record<number, Omit<ErrorPresentation, 'code'>> = {
  400: {
    title: 'Não foi possível concluir a solicitação',
    description: 'Confira os dados informados e tente novamente.',
    recovery: 'retry',
  },
  401: {
    title: 'Entre para continuar',
    description: 'Sua sessão terminou ou você ainda não entrou. Faça login para acessar o sistema.',
    recovery: 'login',
  },
  403: {
    title: 'Acesso não permitido',
    description:
      'Seu usuário não tem permissão para acessar este conteúdo. Se precisar de acesso, fale com o administrador.',
    recovery: 'home',
  },
  404: {
    title: 'Não encontramos este conteúdo',
    description:
      'O endereço pode estar incorreto ou o registro não está mais disponível. Confira o link ou volte ao início.',
    recovery: 'home',
  },
  408: {
    title: 'A resposta demorou mais que o esperado',
    description: 'Não conseguimos concluir a conexão a tempo. Aguarde um pouco e tente novamente.',
    recovery: 'retry',
  },
  409: {
    title: 'Não foi possível aplicar a alteração',
    description:
      'O registro pode ter sido atualizado ou a operação está em conflito com os dados atuais. Confira os dados antes de tentar novamente.',
    recovery: 'retry',
  },
  410: {
    title: 'Este conteúdo não está mais disponível',
    description: 'O conteúdo deste endereço foi removido. Volte ao início para continuar.',
    recovery: 'home',
  },
  413: {
    title: 'O arquivo é muito grande',
    description: 'Escolha um arquivo menor e tente enviar novamente.',
    recovery: 'retry',
  },
  422: {
    title: 'Alguns dados precisam de revisão',
    description: 'Confira os campos indicados no formulário antes de continuar.',
    recovery: 'retry',
  },
  429: {
    title: 'Vamos aguardar um instante',
    description:
      'Recebemos muitas solicitações em pouco tempo. Aguarde um pouco antes de tentar novamente.',
    recovery: 'retry',
  },
  500: {
    title: 'Algo saiu do esperado',
    description:
      'Não conseguimos concluir esta operação. Tente novamente. Se o problema continuar, avise o responsável pelo sistema.',
    recovery: 'retry',
  },
  502: {
    title: 'Falha na comunicação com o servidor',
    description: 'O serviço não respondeu corretamente. Aguarde um pouco e tente novamente.',
    recovery: 'retry',
  },
  503: {
    title: 'Serviço temporariamente indisponível',
    description:
      'O sistema ou um dos serviços conectados está indisponível. Tente novamente em alguns instantes.',
    recovery: 'retry',
  },
  504: {
    title: 'O servidor demorou para responder',
    description: 'A consulta levou mais tempo que o esperado. Aguarde um pouco e tente novamente.',
    recovery: 'retry',
  },
};

/** Nunca repassa mensagens técnicas, URLs internas ou stack traces para a tela. */
export function getErrorPresentation(error?: unknown, offline = false): ErrorPresentation {
  const details =
    error && typeof error === 'object'
      ? (error as { status?: unknown; code?: unknown; message?: unknown; name?: unknown })
      : {};
  const status =
    typeof details.status === 'number' && details.status >= 400 ? details.status : undefined;
  const message = typeof details.message === 'string' ? details.message : '';
  if (
    !status &&
    !offline &&
    (details.name === 'ChunkLoadError' ||
      /dynamically imported module|loading chunk|importing a module script/i.test(message))
  ) {
    return {
      code: 'ATUALIZAÇÃO',
      title: 'Precisamos recarregar esta página',
      description:
        'Não foi possível carregar uma parte do aplicativo. Recarregue para buscar a versão disponível.',
      recovery: 'retry',
    };
  }
  if (
    !status &&
    (offline ||
      details.code === 'NETWORK_ERROR' ||
      /failed to fetch|networkerror|load failed/i.test(message))
  ) {
    return {
      code: 'CONEXÃO',
      title: offline ? 'Você está sem conexão' : 'Não conseguimos conectar',
      description:
        'Verifique sua conexão com a internet e tente novamente. Se a conexão estiver normal, o serviço pode estar indisponível.',
      recovery: 'retry',
    };
  }
  if (status)
    return {
      code: String(status),
      ...(messages[status] ?? (status >= 500 ? messages[500]! : messages[400]!)),
    };
  return { code: 'OPS!', ...messages[500]! };
}
