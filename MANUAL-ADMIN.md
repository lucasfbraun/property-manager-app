# Manual do Painel Admin — Gestao de Alugueis

Ultima atualizacao: 12/07/2026

Este documento explica, de forma objetiva, como usar cada funcionalidade do painel administrativo. Ele tambem serve de base para o chat de ajuda ("?") disponivel dentro do proprio painel admin (o chat busca a resposta mais proxima aqui dentro — nao usa IA externa nem acessa dados de inquilinos, contratos ou pagamentos).

## 1. Papeis de usuario

- **Admin**: acesso total ao painel (`/`, `/cadastros`, `/contratos`, `/rateios`, `/integracoes`). Only o admin ve o chat de ajuda.
- **Inquilino**: portal proprio em `/inquilino` — ve cobrancas, paga via Pix, baixa/assina contrato, registra ocorrencias.
- **Recebedor**: portal proprio em `/recebedor` — ve cobrancas e contratos vinculados a ele, sem editar nada.

## 2. Cadastro de inquilinos

Tela `/cadastros`, formulario "Novo inquilino". Campos: nome completo, CPF/CNPJ, e-mail, WhatsApp, quantidade de moradores (opcional — usado no rateio proporcional) e senha de acesso ao portal (opcional; sem senha o inquilino nao consegue logar, mas o cadastro fica salvo).

Para editar, clique em "Editar" no card do inquilino na lista "Inquilinos". Trocar o e-mail atualiza automaticamente o login vinculado.

## 3. Cadastro de imoveis

Mesma tela `/cadastros`, formulario "Novo imovel". Campos: nome interno (identificacao), endereco, tipo (Apartamento, Casa, Comercial ou Terreno). Status (Disponivel, Alugado, Manutencao) e editado depois na lista.

## 4. Cadastro de recebedores e conexao com o Mercado Pago

Formulario "Novo recebedor": nome, CPF/CNPJ, e-mail, conta Mercado Pago (campo informativo) e senha de acesso ao portal do recebedor (opcional).

Para conectar a conta Mercado Pago de um recebedor: na lista "Recebedores", clique em "Conectar Mercado Pago". Isso abre a tela de autorizacao do proprio Mercado Pago — o recebedor (ou quem administra aquela conta) faz login e autoriza o acesso. Ao voltar, o badge mostra "Mercado Pago conectado (token PRODUCAO ou TESTE, user_id ...)". Cada recebedor conecta a PROPRIA conta (modelo marketplace/split) — nao existe uma conta central unica.

Se o badge mostrar "token TESTE", as cobrancas Pix desse recebedor rodam em modo sandbox (nao gera Pix real). Para producao, o recebedor precisa ativar as credenciais de producao na conta Mercado Pago dele antes de conectar.

## 5. Cadastro de contratos

Formulario "Novo contrato": escolha inquilino, imovel e recebedor, informe valor do aluguel, dia de vencimento e data de fim. O recebedor fica gravado no contrato e e copiado para cada cobranca gerada (preserva o historico mesmo se o contrato for alterado depois).

Editar um contrato (na tabela "Contratos cadastrados") permite ajustar valor, dia de vencimento, data de fim, status, multa (%), juros ao mes (%) e dias de carencia. Ao salvar um contrato com status "Vence em breve", o inquilino recebe automaticamente um aviso por WhatsApp sobre a proximidade do fim do contrato (uma unica vez).

O botao "Enviar lembrete WhatsApp", na mesma linha do contrato, dispara na hora o lembrete que fizer sentido para a cobranca mais recente daquele contrato (antes do vencimento, no dia, em atraso ou pagamento confirmado) — util para testar ou reforcar um aviso sem esperar o envio automatico diario.

## 6. Modelos (templates) de contrato

Tela `/contratos`, painel "Modelos de contrato". Um modelo e um texto livre com variaveis no formato `{{chave}}`. Variaveis disponiveis (17 no total):

- `{{inquilino_nome}}`, `{{inquilino_documento}}`, `{{inquilino_email}}`, `{{inquilino_whatsapp}}`
- `{{imovel_nome}}`, `{{imovel_endereco}}`, `{{imovel_tipo}}`
- `{{recebedor_nome}}`, `{{recebedor_documento}}`
- `{{valor_aluguel}}`, `{{dia_vencimento}}`, `{{data_inicio}}`, `{{data_fim}}`
- `{{multa_percentual}}`, `{{juros_percentual}}`, `{{carencia_dias}}`
- `{{data_geracao}}`

Ha um modelo padrao ja cadastrado ("Locacao residencial padrao"), que pode ser editado ou duplicado. Para criar um modelo novo, preencha nome + texto no formulario "Novo modelo" e clique em "Adicionar modelo".

## 7. Gerar o contrato de um inquilino

Ainda em `/contratos`, tabela "Gerar contrato por inquilino": escolha o modelo no seletor da linha do contrato e clique em "Gerar contrato" (ou "Atualizar contrato", se ja gerado uma vez). Isso preenche as variaveis do modelo com os dados reais daquele contrato e libera o PDF ("Ver PDF") e o fluxo de assinatura para o inquilino.

## 8. Vistoria fotografica

Na mesma linha/card do contrato, clique em "Vistoria (fotos)" para abrir o gerenciador de fotos daquele imovel. E possivel tirar foto direto pela camera do celular ou escolher da galeria, com comodo e observacao opcionais. As fotos ficam embutidas no PDF do contrato (antes do texto/assinatura) e tambem aparecem para o inquilino antes dele assinar. Fazer a vistoria antes de gerar/atualizar o contrato garante que as fotos ja estejam no PDF.

## 9. Assinatura do contrato

Depois que o admin gera o contrato, o inquilino ve o texto e as fotos da vistoria no proprio portal (`/inquilino` → "Ver contrato e assinatura"), baixa o PDF, assina (manual ou digitalmente) e faz upload do arquivo assinado. Isso entra na fila "Aprovacao de contratos assinados" em `/contratos`, onde o admin pode "Ver documento", "Aprovar" ou "Rejeitar" (com observacao opcional). Status possiveis: nao gerado, aguardando assinatura, em analise, aprovado, rejeitado.

## 10. Ocorrencias reportadas pelo inquilino

Inquilinos podem registrar divergencias ou problemas (com fotos) direto no portal deles. O admin acompanha e resolve em `/contratos`, painel "Ocorrencias reportadas pelos inquilinos": marcar "Em analise" ou "Marcar resolvida" (com observacao opcional).

## 11. Geracao de cobranca mensal

Duas formas: manual (botao "Gerar cobranca" na linha do contrato em `/cadastros`) ou automatica (roda todo dia via Cron Trigger, criando a cobranca do mes quando faltam 5 dias para o vencimento). O sistema nunca duplica cobranca do mesmo contrato+mes.

## 12. Cobranca via Pix (Mercado Pago)

Cada cobranca pode gerar um QR Code Pix (mostrado ao inquilino no portal dele) usando a conta Mercado Pago conectada do recebedor daquele contrato. O pagamento e confirmado automaticamente via webhook do Mercado Pago quando configurado; sem webhook configurado (ou em caso de falha), use o botao manual abaixo.

## 13. Verificar pagamento (fallback manual)

Na tabela de contratos em `/cadastros`, o botao "Verificar pagamento" consulta diretamente a API do Mercado Pago o status da ultima cobranca daquele contrato e marca como paga se confirmado. Use quando o webhook nao tiver sido configurado em "Modo producao" no painel do Mercado Pago, ou quando desconfiar que uma confirmacao nao chegou.

## 14. Recibo de pagamento

Depois que uma cobranca esta paga, o inquilino ve um link "Gerar recibo de pagamento" no historico dele, que baixa um PDF de recibo. So fica disponivel para cobrancas com status "Paga".

## 15. Rateios entre imoveis (despesas compartilhadas)

Tela `/rateios`: divida qualquer despesa compartilhada (agua, condominio, gas, internet, IPTU ou outra categoria) entre os imoveis selecionados. Escolha a categoria, uma descricao opcional, o mes de referencia, o valor total e os imoveis participantes; anexe o comprovante se quiser (JPG/PNG/PDF, ate 8MB). O valor pode ser dividido **igualmente** entre os imoveis ou **proporcional ao numero de moradores** de cada um (informado no cadastro do inquilino) — a tela mostra uma pre-visualizacao antes de confirmar. O valor de cada imovel e somado a cobranca do mes correspondente (na hora, se a cobranca ja existir, ou automaticamente quando ela for gerada depois).

## 16. Dashboard

Tela inicial (`/`): totais previstos, recebidos, em aberto e em atraso no periodo; recebimentos por recebedor; contratos ativos; lista de inquilinos. Serve como visao geral rapida do fluxo de caixa.

## 17. Integracoes (WhatsApp)

Tela `/integracoes`: o envio de lembretes por WhatsApp esta **ativo**. Um Cron Trigger da Cloudflare roda todo dia e chama diretamente uma instancia do WAHA (WhatsApp HTTP API, self-hosted na AWS), sem orquestrador no meio. A tela mostra o endpoint configurado, a sessao ativa e a tabela de eventos que disparam mensagem:

- **Antes do vencimento** (5 dias antes), **no dia do vencimento**, **em atraso** (repete a cada 3 dias enquanto nao for pago).
- **Pagamento confirmado** (via webhook do Mercado Pago ou pelo "Verificar pagamento" manual).
- **Contrato vencendo** (quando o status do contrato vira "Vence em breve", ver secao 5).

Alem do envio automatico, o botao "Enviar lembrete WhatsApp" em `/cadastros` (secao 5) permite disparar manualmente a qualquer momento.

## 18. Seguranca e dados sensiveis

O chat de ajuda do painel admin **so responde sobre como usar a aplicacao** (com base neste documento). Ele nunca consulta o banco de dados, nunca mostra nomes de inquilinos, valores de cobranca, tokens do Mercado Pago ou qualquer outro dado real — as respostas vem inteiramente deste manual. O chat nao aparece no portal do inquilino nem no portal do recebedor.
