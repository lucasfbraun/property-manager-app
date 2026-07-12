/**
 * Knowledge base for the admin-only help chat ("?" widget). This is a plain
 * keyword-search FAQ, not an external AI/LLM — no question or answer ever
 * leaves the server, and the search never touches real app data (tenants,
 * contracts, charges, tokens, etc.). It only searches the static entries
 * below, which mirror MANUAL-ADMIN.md at the project root.
 *
 * Keep this in sync with MANUAL-ADMIN.md when a feature changes.
 */

export type HelpEntry = {
  id: string;
  title: string;
  /** Extra search terms/synonyms beyond what's already in title/answer. */
  keywords: string[];
  answer: string;
};

export const HELP_ENTRIES: HelpEntry[] = [
  {
    answer:
      "Admin: acesso total ao painel (Dashboard, Cadastros, Contratos, Rateios, Integracoes) e o unico que ve este chat de ajuda. Inquilino: portal proprio em /inquilino (cobrancas, Pix, contrato, ocorrencias). Recebedor: portal proprio em /recebedor, so leitura das cobrancas e contratos vinculados a ele.",
    id: "papeis",
    keywords: ["papel", "papeis", "perfil", "perfis", "permissao", "permissoes", "acesso", "login", "usuario", "admin", "administrador", "inquilino", "recebedor", "portal"],
    title: "Quais sao os papeis de usuario (admin, inquilino, recebedor)?",
  },
  {
    answer:
      "Va em Cadastros > 'Novo inquilino'. Preencha nome completo, CPF/CNPJ, e-mail, WhatsApp. Quantidade de moradores e opcional (usada no rateio proporcional). Senha de acesso ao portal tambem e opcional — sem senha o cadastro fica salvo, mas o inquilino nao consegue logar no portal dele. Para editar depois, clique em 'Editar' no card do inquilino.",
    id: "cadastrar-inquilino",
    keywords: ["cadastrar", "cadastro", "criar", "novo", "inquilino", "morador", "moradores", "senha", "editar inquilino", "quantidade de moradores"],
    title: "Como cadastrar (ou editar) um inquilino?",
  },
  {
    answer:
      "Va em Cadastros > 'Novo imovel'. Preencha nome interno (identificacao), endereco e tipo (Apartamento, Casa, Comercial ou Terreno). O status (Disponivel, Alugado, Manutencao) e ajustado depois, editando o imovel na lista.",
    id: "cadastrar-imovel",
    keywords: ["cadastrar", "cadastro", "criar", "novo", "imovel", "imoveis", "propriedade", "apartamento", "casa"],
    title: "Como cadastrar um imovel?",
  },
  {
    answer:
      "Va em Cadastros > 'Novo recebedor'. Preencha nome, CPF/CNPJ, e-mail e conta Mercado Pago (campo informativo). Senha de acesso ao portal do recebedor e opcional.",
    id: "cadastrar-recebedor",
    keywords: ["cadastrar", "cadastro", "criar", "novo", "recebedor", "recebedores"],
    title: "Como cadastrar um recebedor?",
  },
  {
    answer:
      "Na lista de Recebedores (tela Cadastros), clique em 'Conectar Mercado Pago' no card do recebedor. Voce sera levado a tela de autorizacao do proprio Mercado Pago — o recebedor (ou quem administra aquela conta) faz login e autoriza o acesso. Ao voltar, o card mostra um selo 'Mercado Pago conectado' com o tipo de token (PRODUCAO ou TESTE) e o user_id. Cada recebedor conecta a PROPRIA conta Mercado Pago (modelo marketplace/split) — nao existe uma conta central unica para todos. Se aparecer 'token TESTE', as cobrancas desse recebedor rodam em modo sandbox (nao gera Pix real); para producao, o recebedor precisa ativar as credenciais de producao na conta Mercado Pago dele antes de conectar.",
    id: "conectar-mercado-pago",
    keywords: ["mercado pago", "conectar", "oauth", "token", "sandbox", "producao", "conta mercado pago", "integrar mercado pago", "vincular mercado pago"],
    title: "Como conectar a conta do Mercado Pago de um recebedor?",
  },
  {
    answer:
      "Va em Cadastros > 'Novo contrato'. Escolha inquilino, imovel e recebedor, informe valor do aluguel, dia de vencimento e data de fim. O recebedor fica gravado no contrato e e copiado para cada cobranca gerada, preservando o historico mesmo se o contrato mudar depois. Para editar (valor, vencimento, status, multa, juros, carencia), use o botao 'Editar' na tabela ou nos cards de Contratos cadastrados.",
    id: "cadastrar-contrato",
    keywords: ["cadastrar", "cadastro", "criar", "novo", "contrato", "editar contrato", "multa", "juros", "carencia", "vencimento"],
    title: "Como cadastrar (ou editar) um contrato?",
  },
  {
    answer:
      "Um modelo de contrato e um texto livre com variaveis no formato {{chave}}, criado na tela Contratos > 'Modelos de contrato'. Existem 17 variaveis disponiveis: inquilino_nome, inquilino_documento, inquilino_email, inquilino_whatsapp, imovel_nome, imovel_endereco, imovel_tipo, recebedor_nome, recebedor_documento, valor_aluguel, dia_vencimento, data_inicio, data_fim, multa_percentual, juros_percentual, carencia_dias e data_geracao. Ja existe um modelo padrao pronto ('Locacao residencial padrao'), que pode ser editado ou usado como base para outros.",
    id: "modelo-contrato",
    keywords: ["modelo", "template", "templates", "variaveis", "variavel", "chaves", "clausula", "clausulas", "texto do contrato"],
    title: "O que e um modelo (template) de contrato e quais variaveis ele aceita?",
  },
  {
    answer:
      "Na tela Contratos, tabela 'Gerar contrato por inquilino', escolha o modelo no seletor da linha do contrato e clique em 'Gerar contrato' (ou 'Atualizar contrato' se ja foi gerado antes). O sistema preenche as variaveis do modelo com os dados reais daquele contrato, libera o PDF ('Ver PDF') e libera o fluxo de assinatura para o inquilino no portal dele.",
    id: "gerar-contrato",
    keywords: ["gerar contrato", "gerar documento", "atualizar contrato", "pdf do contrato", "ver pdf"],
    title: "Como gerar o contrato (PDF) de um inquilino a partir de um modelo?",
  },
  {
    answer:
      "Na linha/card do contrato (tela Contratos), clique em 'Vistoria (fotos)'. Voce pode tirar foto direto pela camera do celular ou escolher da galeria, com comodo e observacao opcionais. As fotos ficam embutidas no PDF do contrato (antes do texto e da assinatura) e tambem aparecem para o inquilino antes dele assinar. O ideal e fazer a vistoria ANTES de gerar/atualizar o contrato, para que as fotos ja entrem no PDF.",
    id: "vistoria",
    keywords: ["vistoria", "foto", "fotos", "camera", "inspecao", "estado do imovel"],
    title: "Como registrar a vistoria fotografica de um imovel?",
  },
  {
    answer:
      "Depois que o admin gera o contrato, o inquilino ve o texto e as fotos da vistoria no proprio portal (/inquilino > 'Ver contrato e assinatura'), baixa o PDF, assina (manual ou digitalmente) e faz upload do arquivo assinado. Isso entra na fila 'Aprovacao de contratos assinados' (tela Contratos), onde o admin pode ver o documento, aprovar ou rejeitar (com observacao opcional). Status possiveis: nao gerado, aguardando assinatura, em analise, aprovado, rejeitado.",
    id: "assinatura",
    keywords: ["assinatura", "assinar", "aprovar contrato", "rejeitar contrato", "upload contrato assinado", "status do contrato"],
    title: "Como funciona a assinatura e aprovacao do contrato?",
  },
  {
    answer:
      "O inquilino registra ocorrencias (com fotos) direto no portal dele, quando ha desacordo sobre o estado do imovel ou outro problema. O admin acompanha na tela Contratos, painel 'Ocorrencias reportadas pelos inquilinos', e pode marcar como 'Em analise' ou 'Marcar resolvida' (com observacao opcional).",
    id: "ocorrencias",
    keywords: ["ocorrencia", "ocorrencias", "problema", "divergencia", "reclamacao"],
    title: "Como funcionam as ocorrencias reportadas pelo inquilino?",
  },
  {
    answer:
      "De duas formas: manual, clicando em 'Gerar cobranca' na linha do contrato (tela Cadastros); ou automatica, via Cron Trigger que roda todo dia e cria a cobranca do mes quando faltam 5 dias para o vencimento. O sistema nunca duplica a cobranca do mesmo contrato no mesmo mes.",
    id: "gerar-cobranca",
    keywords: ["gerar cobranca", "cobranca mensal", "cobranca automatica", "cron"],
    title: "Como e gerada a cobranca mensal?",
  },
  {
    answer:
      "Cada cobranca pode gerar um QR Code Pix (mostrado ao inquilino no portal dele), usando a conta Mercado Pago conectada do recebedor daquele contrato. O pagamento e confirmado automaticamente via webhook do Mercado Pago quando ele estiver configurado; se o webhook nao chegar (ou nao estiver em modo producao), use o botao 'Verificar pagamento'.",
    id: "cobranca-pix",
    keywords: ["pix", "qr code", "cobranca pix", "pagar", "pagamento"],
    title: "Como funciona a cobranca via Pix?",
  },
  {
    answer:
      "Na tabela de Contratos (tela Cadastros), clique em 'Verificar pagamento' na linha do contrato. Isso consulta diretamente a API do Mercado Pago o status da ultima cobranca daquele contrato e marca como paga se a Mercado Pago confirmar. Use quando o webhook do Mercado Pago nao estiver configurado em 'Modo producao', ou quando desconfiar que uma confirmacao automatica nao chegou.",
    id: "verificar-pagamento",
    keywords: ["verificar pagamento", "webhook", "fallback", "confirmar pagamento manualmente", "nao confirmou pagamento"],
    title: "O que fazer se um pagamento Pix nao foi confirmado automaticamente?",
  },
  {
    answer:
      "Depois que a cobranca esta com status 'Paga', o inquilino ve um link 'Gerar recibo de pagamento' no historico dele (portal do inquilino), que baixa um PDF de recibo. Esse link so aparece para cobrancas pagas.",
    id: "recibo",
    keywords: ["recibo", "comprovante de pagamento", "recibo de pagamento", "pdf do recibo"],
    title: "Como o inquilino gera o recibo de pagamento?",
  },
  {
    answer:
      "Na tela /rateios: escolha a categoria da despesa (Agua, Condominio, Gas, Internet/TV, IPTU ou Outro, com descricao livre), o mes de referencia, o valor total e quais imoveis participam; anexar o comprovante e opcional (JPG/PNG/PDF, ate 8MB). O valor pode ser dividido igualmente entre os imoveis ou proporcional ao numero de moradores de cada um (informado no cadastro do inquilino) — a tela mostra uma pre-visualizacao do valor por imovel antes de confirmar. O valor de cada imovel e somado a cobranca do mes correspondente (na hora, se a cobranca ja existir, ou automaticamente quando ela for gerada depois).",
    id: "rateio",
    keywords: ["rateio", "rateios", "dividir despesa", "agua", "condominio", "gas", "iptu", "despesa compartilhada", "proporcional a moradores"],
    title: "Como fazer um rateio de despesa entre imoveis (agua, condominio, gas...)?",
  },
  {
    answer:
      "A tela inicial (Dashboard) mostra os totais previstos, recebidos, em aberto e em atraso no periodo, os recebimentos por recebedor, os contratos ativos e a lista de inquilinos — e uma visao geral rapida do fluxo de caixa.",
    id: "dashboard",
    keywords: ["dashboard", "painel inicial", "resumo", "relatorio", "totais", "visao geral"],
    title: "O que o Dashboard mostra?",
  },
  {
    answer:
      "A tela Integracoes mostra a configuracao planejada para lembretes automaticos via WhatsApp (um Cron Trigger da Cloudflare chamando o WAHA diretamente, sem orquestrador no meio). Essa parte ainda depende de credenciais/infraestrutura do WAHA e ainda nao esta ativa em producao — hoje e so planejamento documentado.",
    id: "whatsapp",
    keywords: ["whatsapp", "lembrete", "lembretes", "waha", "integracao", "mensagem automatica"],
    title: "Como funciona a integracao com WhatsApp?",
  },
  {
    answer:
      "Este chat so responde sobre como usar a aplicacao, com base no manual interno do painel. Ele nunca consulta o banco de dados, nunca mostra nomes de inquilinos, valores de cobranca, tokens do Mercado Pago ou qualquer outro dado real — as respostas vem inteiramente de um documento estatico de ajuda. Tambem nao existe no portal do inquilino nem no portal do recebedor, so aqui no painel admin.",
    id: "seguranca-chat",
    keywords: ["dados sensiveis", "seguranca", "privacidade", "ia", "inteligencia artificial", "chat", "quem ve o chat"],
    title: "Esse chat acessa dados sensiveis ou aparece para o inquilino?",
  },
];

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ");
}

const STOPWORDS = new Set([
  "a", "o", "os", "as", "de", "do", "da", "dos", "das", "e", "ou", "um", "uma",
  "para", "por", "com", "sem", "no", "na", "nos", "nas", "que", "como", "eu",
  "meu", "minha", "quero", "gostaria", "voce", "tem", "ter", "fazer", "faz",
  "onde", "qual", "quais", "se", "ao", "aos", "em", "consigo", "posso",
]);

function tokenize(text: string): string[] {
  return normalize(text)
    .split(/\s+/)
    .filter((word) => word.length > 1 && !STOPWORDS.has(word));
}

export type HelpSearchResult = HelpEntry & { score: number };

/**
 * Very small keyword-overlap ranking: no external AI call, so answers are
 * limited to whatever's written in HELP_ENTRIES above (never hallucinated,
 * never touches live app data).
 */
export function searchHelp(query: string, limit = 3): HelpSearchResult[] {
  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) {
    return [];
  }

  const scored = HELP_ENTRIES.map((entry) => {
    const titleTokens = tokenize(entry.title);
    const keywordTokens = entry.keywords.flatMap((keyword) => tokenize(keyword));
    const answerTokens = tokenize(entry.answer);

    let score = 0;
    for (const queryToken of queryTokens) {
      if (keywordTokens.some((token) => token === queryToken || token.includes(queryToken))) {
        score += 4;
      }
      if (titleTokens.some((token) => token === queryToken || token.includes(queryToken))) {
        score += 3;
      }
      if (answerTokens.includes(queryToken)) {
        score += 1;
      }
    }
    return { ...entry, score };
  });

  return scored
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
