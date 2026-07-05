# Aplicação Web para Gestão de Aluguéis, Contratos e Pagamentos

## 1. Visão do Produto

A aplicação será um sistema web monolítico para controlar imóveis alugados, inquilinos, contratos, cobranças mensais, pagamentos, atrasos, juros, lembretes e repasses para diferentes recebedores.

O objetivo principal é centralizar a gestão dos aluguéis recebidos por Lucas e seus irmãos, permitindo que cada contrato defina quem deve receber o pagamento daquele inquilino.

Exemplo de regra:

- Inquilino 1 paga aluguel do imóvel A e o recebedor é Lucas.
- Inquilino 2 paga aluguel do imóvel B e o recebedor é Guilherme.
- Inquilino 3 paga aluguel do imóvel C e o recebedor é outro familiar.

O sistema também deverá oferecer um portal para o inquilino consultar cobranças, contratos e comprovantes, além de pagar via Pix ou cartão de crédito.

## 2. Objetivos de Negócio

- Controlar todos os contratos de aluguel em um único sistema.
- Reduzir controle manual de pagamentos.
- Permitir cobrança por Pix e cartão.
- Registrar automaticamente pagamentos confirmados pelo Mercado Pago.
- Definir o recebedor correto por contrato.
- Aplicar multa e juros em caso de atraso.
- Enviar lembretes de pagamento por WhatsApp.
- Dar transparência ao inquilino sobre cobranças, histórico e contrato.
- Gerar relatórios para acompanhamento financeiro.
- Manter histórico confiável para auditoria e conferência.

## 3. Arquitetura Recomendada

A aplicação deve começar como um monolito web.

Stack sugerida:

- Backend e frontend no mesmo projeto.
- Banco de dados relacional, preferencialmente PostgreSQL.
- Fila de jobs para tarefas assíncronas.
- Painel administrativo.
- Portal do inquilino.
- Integrações externas com Mercado Pago e provedor de WhatsApp.

Frameworks recomendados:

- Laravel + PostgreSQL, ou
- Django + PostgreSQL.

Ambos são boas escolhas para monolitos administrativos, autenticação, permissões, filas, jobs, relatórios e regras financeiras.

## 4. Perfis de Usuário

### 4.1 Administrador

Responsável pela gestão completa do sistema.

Permissões:

- Cadastrar imóveis.
- Cadastrar inquilinos.
- Cadastrar recebedores.
- Criar e encerrar contratos.
- Gerar cobranças.
- Consultar todos os pagamentos.
- Configurar juros, multa e lembretes.
- Acessar relatórios gerais.
- Gerenciar integrações.
- Visualizar logs e auditoria.

### 4.2 Recebedor

Pessoa que recebe os valores de determinados contratos, como Lucas, Guilherme ou outro irmão.

Permissões:

- Visualizar contratos vinculados a ele.
- Visualizar cobranças vinculadas a ele.
- Acompanhar valores pagos, pendentes e vencidos.
- Receber notificações de pagamentos.
- Exportar relatórios dos próprios recebimentos.

### 4.3 Inquilino

Usuário externo com acesso limitado ao próprio portal.

Permissões:

- Visualizar contrato ativo.
- Visualizar cobranças abertas.
- Visualizar histórico de pagamentos.
- Pagar via Pix ou cartão.
- Baixar comprovantes.
- Baixar contrato.
- Atualizar dados de contato, quando permitido.
- Receber lembretes e notificações.

## 5. Módulos da Aplicação

### 5.1 Imóveis

Campos principais:

- Nome ou identificação interna.
- Tipo do imóvel.
- Endereço completo.
- Valor padrão do aluguel.
- Status do imóvel.
- Observações.
- Anexos do imóvel.

Status sugeridos:

- Disponível.
- Alugado.
- Em manutenção.
- Inativo.

Recursos adicionais recomendados:

- Registro de IPTU.
- Registro de condomínio.
- Fotos do imóvel.
- Histórico de ocupação.
- Vistoria inicial e final.

### 5.2 Inquilinos

Campos principais:

- Nome completo.
- CPF ou CNPJ.
- E-mail.
- Telefone.
- WhatsApp.
- Endereço.
- Status.
- Observações.

Status sugeridos:

- Ativo.
- Inativo.
- Inadimplente.
- Ex-inquilino.

Recursos adicionais recomendados:

- Cadastro de fiador.
- Mais de um responsável financeiro.
- Histórico de contratos.
- Histórico de pagamentos.
- Histórico de comunicações.

### 5.3 Recebedores

Campos principais:

- Nome.
- CPF ou CNPJ.
- E-mail.
- Telefone.
- Conta Mercado Pago vinculada.
- Chave Pix informativa, se aplicável.
- Status.

Regra importante:

O recebedor deve ser definido no contrato e copiado para cada cobrança gerada. Isso preserva o histórico financeiro mesmo que o contrato seja alterado no futuro.

### 5.4 Contratos

Campos principais:

- Imóvel.
- Inquilino.
- Recebedor.
- Valor do aluguel.
- Data de início.
- Data de término.
- Dia de vencimento.
- Multa por atraso.
- Juros por atraso.
- Carência para atraso, se houver.
- Índice de reajuste, se houver.
- Valor de caução, se houver.
- Status.
- Documento do contrato.

Status sugeridos:

- Rascunho.
- Ativo.
- Vencido.
- Em renovação.
- Encerrado.
- Cancelado.

Recursos adicionais recomendados:

- Upload do contrato assinado.
- Geração de contrato por modelo.
- Controle de renovação.
- Alerta de contrato próximo do vencimento.
- Histórico de alterações.
- Registro de vistoria inicial e final.

### 5.5 Cobranças

Cada cobrança representa uma mensalidade ou valor a receber.

Campos principais:

- Contrato.
- Inquilino.
- Imóvel.
- Recebedor.
- Competência.
- Data de vencimento.
- Valor original.
- Valor de multa.
- Valor de juros.
- Valor atualizado.
- Status.
- Link de pagamento.
- Identificador no Mercado Pago.

Status sugeridos:

- Aberta.
- Aguardando pagamento.
- Paga.
- Vencida.
- Parcialmente paga.
- Cancelada.
- Estornada.
- Em contestação.

Regras:

- Gerar cobranças mensais automaticamente.
- Permitir criação manual de cobrança.
- Permitir desconto ou abono com justificativa.
- Permitir cancelamento com justificativa.
- Preservar histórico de valores.

### 5.6 Pagamentos

Campos principais:

- Cobrança vinculada.
- Inquilino.
- Recebedor.
- Método de pagamento.
- Valor pago.
- Valor líquido.
- Taxas.
- Data de pagamento.
- Status no Mercado Pago.
- ID do pagamento externo.
- Comprovante.

Métodos previstos:

- Pix.
- Cartão de crédito.

Status sugeridos:

- Pendente.
- Aprovado.
- Recusado.
- Cancelado.
- Estornado.
- Em análise.

### 5.7 Integração com Mercado Pago

Recursos necessários:

- Criar cobrança Pix.
- Criar cobrança por cartão.
- Receber webhook de pagamento.
- Validar assinatura ou origem do webhook.
- Atualizar status da cobrança automaticamente.
- Registrar payload recebido para auditoria.
- Permitir reprocessamento de webhooks com falha.

Decisão técnica importante:

Antes da implementação, deve ser definido como será o modelo de recebimento:

- Uma conta Mercado Pago centralizada.
- Uma conta Mercado Pago por recebedor.
- Conexão OAuth com múltiplas contas.
- Modelo marketplace/split, caso disponível e adequado.

Essa decisão afeta diretamente a implementação financeira e contábil.

### 5.8 Juros, Multa e Atrasos

Regras recomendadas:

- Multa percentual após vencimento.
- Juros diário ou mensal proporcional.
- Carência opcional antes de aplicar multa.
- Valor atualizado calculado automaticamente.
- Possibilidade de abonar multa ou juros.
- Registro de quem realizou o abono.

Exemplo:

- Multa: 2% após vencimento.
- Juros: 1% ao mês proporcional aos dias de atraso.
- Carência: 0 a 3 dias, conforme contrato.

### 5.9 Portal do Inquilino

Funcionalidades:

- Login seguro.
- Visualização do contrato.
- Visualização de cobranças abertas.
- Pagamento por Pix ou cartão.
- Histórico de pagamentos.
- Download de comprovantes.
- Download de contrato.
- Atualização de dados de contato.
- Abertura de solicitações de manutenção, em uma fase futura.

### 5.10 WhatsApp e Lembretes

Eventos de envio:

- Lembrete antes do vencimento.
- Aviso no dia do vencimento.
- Aviso após vencimento.
- Aviso de pagamento confirmado.
- Aviso de contrato próximo do vencimento, para administrador.

Regras:

- Evitar mensagens duplicadas.
- Registrar data e hora de envio.
- Registrar status de entrega, quando disponível.
- Permitir desativar lembretes por inquilino.
- Permitir configurar dias e horários de envio.
- Incluir link de pagamento na mensagem.

Provedores possíveis:

- WhatsApp Business API oficial.
- Twilio.
- 360dialog.
- Z-API.
- WATI.

## 6. Dashboard Administrativo

Indicadores recomendados:

- Total previsto para o mês.
- Total recebido no mês.
- Total em atraso.
- Quantidade de contratos ativos.
- Quantidade de cobranças vencidas.
- Quantidade de inquilinos inadimplentes.
- Contratos próximos do vencimento.
- Pagamentos por recebedor.
- Imóveis alugados e disponíveis.

Filtros:

- Período.
- Recebedor.
- Imóvel.
- Inquilino.
- Status da cobrança.

## 7. Relatórios

Relatórios essenciais:

- Pagamentos por período.
- Cobranças abertas.
- Cobranças vencidas.
- Recebimentos por recebedor.
- Recebimentos por imóvel.
- Histórico por inquilino.
- Contratos ativos.
- Contratos próximos do vencimento.
- Taxas cobradas pelo Mercado Pago.

Exportações:

- Excel.
- CSV.
- PDF.

Relatório adicional recomendado:

- Demonstrativo anual para apoio ao imposto de renda.

## 8. Segurança e LGPD

Requisitos:

- Senhas criptografadas.
- Controle de sessão.
- Recuperação de senha.
- Controle de permissões por perfil.
- Separação clara dos dados de cada inquilino.
- Separação clara dos dados de cada recebedor.
- Log de ações sensíveis.
- Backups automáticos.
- Política de privacidade.
- Registro de consentimento para comunicações.
- Proteção de dados pessoais.

Dados sensíveis:

- CPF/CNPJ.
- Endereço.
- Telefone.
- E-mail.
- Contratos.
- Comprovantes.
- Dados financeiros.

## 9. Auditoria

A aplicação deve registrar:

- Criação e alteração de contratos.
- Alteração de valores.
- Abono de juros ou multa.
- Cancelamento de cobrança.
- Confirmação de pagamento.
- Reprocessamento de webhook.
- Alteração de recebedor.
- Acesso a documentos sensíveis.

Cada registro deve conter:

- Usuário responsável.
- Data e hora.
- Entidade afetada.
- Valor anterior.
- Novo valor.
- Justificativa, quando aplicável.

## 10. MVP Recomendado

A primeira versão deve focar no fluxo principal de recebimento.

Escopo do MVP:

1. Cadastro de usuários e permissões.
2. Cadastro de imóveis.
3. Cadastro de inquilinos.
4. Cadastro de recebedores.
5. Cadastro de contratos.
6. Geração mensal de cobranças.
7. Cálculo de multa e juros.
8. Integração Mercado Pago com Pix.
9. Webhook de confirmação de pagamento.
10. Portal simples do inquilino.
11. Lembretes por WhatsApp.
12. Dashboard administrativo.
13. Relatórios básicos.

Fora do MVP inicial:

- Cartão de crédito.
- Assinatura digital.
- Geração automática completa de contrato.
- Solicitações de manutenção.
- Relatórios fiscais avançados.
- Aplicativo mobile.

## 11. Entidades Principais

- Usuário.
- Perfil.
- Permissão.
- Imóvel.
- Inquilino.
- Recebedor.
- Contrato.
- Cobrança.
- Pagamento.
- Documento.
- Webhook.
- Lembrete.
- Mensagem WhatsApp.
- Log de auditoria.
- Configuração financeira.

## 12. Regras de Negócio Críticas

1. O recebedor deve ser definido no contrato.
2. Cada cobrança deve guardar o recebedor vigente no momento da geração.
3. Pagamentos confirmados por webhook devem ser idempotentes.
4. Uma cobrança paga não deve ser paga novamente.
5. Alterações manuais em valores devem exigir justificativa.
6. Juros e multa devem respeitar a regra do contrato.
7. Inquilino só pode acessar os próprios dados.
8. Recebedor só pode acessar dados vinculados a ele.
9. Webhooks devem ser registrados antes do processamento.
10. Cancelamentos e estornos devem preservar histórico.

## 13. Roadmap Pós-MVP

Funcionalidades futuras:

- Cartão de crédito.
- Parcelamento.
- Assinatura digital.
- Geração de contratos por modelo.
- Reajuste automático por índice.
- Solicitações de manutenção.
- Registro de vistorias.
- Painel de documentos.
- Régua de cobrança avançada.
- Demonstrativo anual.
- Aplicativo mobile ou PWA.

## 14. Principais Riscos

- Definição incorreta do modelo de recebimento no Mercado Pago.
- Webhooks duplicados ou perdidos.
- Cálculo incorreto de juros e multa.
- Falta de separação de permissões entre recebedores.
- Envio duplicado de mensagens WhatsApp.
- Armazenamento inseguro de documentos e dados pessoais.
- Baixa clareza para o inquilino na hora de pagar.

## 15. Próximas Decisões

Antes de iniciar o desenvolvimento, recomenda-se decidir:

- Qual stack será usada: Laravel, Django ou outra.
- Como cada recebedor será vinculado ao Mercado Pago.
- Se o Pix será obrigatório no MVP.
- Se cartão entra no MVP ou na fase 2.
- Qual provedor de WhatsApp será usado.
- Se haverá geração automática de contrato no MVP.
- Quais relatórios são indispensáveis na primeira versão.

