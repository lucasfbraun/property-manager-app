# Andamento do Desenvolvimento

## Concluido

- [x] Criada especificacao inicial da aplicacao em Markdown.
- [x] Criado cronograma inicial em Excel.
- [x] Iniciada base monolitica do projeto web.
- [x] Definida stack inicial: Vinext/Next + React + TypeScript em um unico projeto.
- [x] Criado dominio inicial com imoveis, inquilinos, recebedores, contratos, cobrancas e pagamentos.
- [x] Implementado calculo inicial de multa, juros e valor atualizado.
- [x] Criado painel administrativo inicial.
- [x] Criado portal inicial do inquilino.
- [x] Criado schema relacional inicial para persistencia futura.
- [x] Criados contratos tecnicos para integracoes Mercado Pago e WhatsApp.
- [x] Validado build da aplicacao.
- [x] Servidor local iniciado em `http://localhost:3000`.
- [x] Criada rota `/cadastros`.
- [x] Criados formularios iniciais para inquilino, imovel, recebedor e contrato.
- [x] Criada validacao inicial dos campos obrigatorios nos cadastros.
- [x] Gerada migracao inicial do banco com 9 tabelas.
- [x] Definida integracao WhatsApp com n8n + WAHA.
- [x] Criada documentacao da integracao WhatsApp.
- [x] Criada rota `/integracoes`.
- [x] Criada camada de repositorio D1 para os dados principais.
- [x] Criadas APIs internas para listar e criar cadastros.
- [x] Tela de cadastros passou a salvar no D1 local.
- [x] Painel passou a carregar inquilinos, imoveis, recebedores e contratos do repositorio.
- [x] Painel e portal passaram a usar cobrancas carregadas do D1 local.
- [x] Portal do inquilino passou a consultar dados persistidos do monolito.
- [x] Criada exclusao minima de inquilino sem contrato vinculado.
- [x] Ampliada exclusao segura para inquilinos, imoveis, recebedores e contratos.
- [x] Tela de cadastros passou a listar registros salvos com acoes de exclusao.
- [x] Builder do cronograma atualizado com etapas concluidas/em andamento.
- [x] Reexportado `outputs/cronograma-aplicacao-alugueis.xlsx` com o cronograma atualizado.
- [x] Aplicada paleta visual Azul Tecnologico na aplicacao.
- [x] Ajustados CTAs, links ativos, fundos e superficies para a nova identidade.
- [x] Modernizado design do dashboard com shell lateral, cards e tabela refinada.
- [x] Refinadas telas de cadastros, portal do inquilino e integracoes com visual mais SaaS.

## Em andamento

- [ ] Evoluir CRUD inicial para edicao completa.
- [ ] Implementar autenticacao real por perfil.
- [ ] Implementar envio real de lembretes para webhook do n8n.

## Pendente

- [ ] Definir modelo exato de recebimento no Mercado Pago.
- [x] Escolher provedor de WhatsApp: WAHA com orquestracao n8n.
- [x] Implementar persistencia inicial com D1 local.
- [ ] Implementar edicao completa de imoveis, inquilinos, recebedores e contratos.
- [ ] Implementar geracao mensal automatica de cobrancas.
- [ ] Implementar Pix real via Mercado Pago.
- [ ] Implementar webhooks reais.
- [ ] Configurar credenciais reais do n8n e WAHA.
- [ ] Implementar calculo financeiro com testes automatizados.
- [ ] Implementar relatorios exportaveis.

## Decisoes Tecnicas

- O projeto sera mantido como monolito: interface, rotas de servidor, regras de negocio e acesso a dados no mesmo repositorio.
- A primeira versao usa dados de semente para validar telas e regras.
- As rotas principais usam o D1 local como fonte dos cadastros e cobrancas iniciais.
- A estrutura deve permitir troca posterior para PostgreSQL ou D1 sem redesenhar a experiencia.
