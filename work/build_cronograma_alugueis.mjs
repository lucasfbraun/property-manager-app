import fs from "node:fs/promises";
import path from "node:path";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const rootDir = process.cwd();
const outputDir = path.join(rootDir, "outputs");
const qaDir = path.join(rootDir, "work", "qa-cronograma");

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(qaDir, { recursive: true });

const workbook = Workbook.create();

const cronograma = workbook.worksheets.add("Cronograma");
const resumo = workbook.worksheets.add("Resumo");
const riscos = workbook.worksheets.add("Riscos");

const phases = [
  {
    id: 1,
    fase: "Descoberta e modelagem",
    entrega: "Validar regras de negocio, modelo de recebimento e escopo do MVP",
    inicio: "2026-07-01",
    fim: "2026-07-07",
    prioridade: "Alta",
    responsavel: "Produto / Negocio",
    status: "Concluido",
    dependencia: "Nenhuma",
    obs: "Requisitos, MVP, entregaveis iniciais e decisao WhatsApp WAHA+n8n documentados.",
  },
  {
    id: 2,
    fase: "Arquitetura e base tecnica",
    entrega: "Criar monolito, banco, autenticacao base, filas e ambientes",
    inicio: "2026-07-08",
    fim: "2026-07-14",
    prioridade: "Alta",
    responsavel: "Desenvolvimento",
    status: "Em andamento",
    dependencia: "Fase 1",
    obs: "Monolito Vinext/Next criado com D1 local, schema, migracao e APIs internas. Autenticacao ainda pendente.",
  },
  {
    id: 3,
    fase: "Usuarios e permissoes",
    entrega: "Perfis de administrador, recebedor e inquilino",
    inicio: "2026-07-15",
    fim: "2026-07-28",
    prioridade: "Alta",
    responsavel: "Desenvolvimento",
    status: "Nao iniciado",
    dependencia: "Fase 2",
    obs: "Garantir que recebedor e inquilino vejam apenas os proprios dados.",
  },
  {
    id: 4,
    fase: "Cadastros principais",
    entrega: "Imoveis, inquilinos, recebedores e dados auxiliares",
    inicio: "2026-07-29",
    fim: "2026-08-11",
    prioridade: "Alta",
    responsavel: "Desenvolvimento",
    status: "Em andamento",
    dependencia: "Fase 3",
    obs: "Formularios iniciais e criacao via API/D1 local prontos. Exclusao segura ampliada. Edicao completa ainda pendente.",
  },
  {
    id: 5,
    fase: "Contratos",
    entrega: "Cadastro de contratos, vencimento, recebedor, valores e anexos",
    inicio: "2026-08-12",
    fim: "2026-08-25",
    prioridade: "Alta",
    responsavel: "Desenvolvimento",
    status: "Em andamento",
    dependencia: "Fase 4",
    obs: "Cadastro inicial de contrato salva recebedor no D1. Anexos, renovacao e encerramento ainda pendentes.",
  },
  {
    id: 6,
    fase: "Cobrancas e regras financeiras",
    entrega: "Geracao mensal, multa, juros, descontos, cancelamentos e historico",
    inicio: "2026-08-26",
    fim: "2026-09-08",
    prioridade: "Alta",
    responsavel: "Desenvolvimento",
    status: "Em andamento",
    dependencia: "Fase 5",
    obs: "Calculo inicial de multa, juros e valor atualizado implementado. Cobrancas agora sao lidas do D1 nas telas principais.",
  },
  {
    id: 7,
    fase: "Mercado Pago Pix",
    entrega: "Geracao de cobrancas Pix e links de pagamento",
    inicio: "2026-09-09",
    fim: "2026-09-22",
    prioridade: "Alta",
    responsavel: "Desenvolvimento / Integracoes",
    status: "Nao iniciado",
    dependencia: "Fase 6",
    obs: "Comecar com Pix no MVP para reduzir complexidade de cartao.",
  },
  {
    id: 8,
    fase: "Webhooks e conciliacao",
    entrega: "Confirmacao automatica de pagamento, idempotencia e reprocessamento",
    inicio: "2026-09-23",
    fim: "2026-09-29",
    prioridade: "Alta",
    responsavel: "Desenvolvimento / Integracoes",
    status: "Nao iniciado",
    dependencia: "Fase 7",
    obs: "Registrar payloads antes de processar para auditoria.",
  },
  {
    id: 9,
    fase: "Portal do inquilino",
    entrega: "Consulta de contrato, cobrancas, historico, comprovantes e pagamento",
    inicio: "2026-09-30",
    fim: "2026-10-13",
    prioridade: "Alta",
    responsavel: "Desenvolvimento / UX",
    status: "Em andamento",
    dependencia: "Fases 6 a 8",
    obs: "Portal inicial criado e conectado aos dados persistidos do D1 para contratos, cobrancas e historico.",
  },
  {
    id: 10,
    fase: "WhatsApp e lembretes",
    entrega: "Regua de avisos antes do vencimento, no vencimento e em atraso",
    inicio: "2026-10-14",
    fim: "2026-10-27",
    prioridade: "Media",
    responsavel: "Desenvolvimento / Integracoes",
    status: "Em andamento",
    dependencia: "Fases 6 e 9",
    obs: "Decisao tomada: n8n como orquestrador e WAHA como gateway WhatsApp. Envio real pendente.",
  },
  {
    id: 11,
    fase: "Dashboard e relatorios",
    entrega: "Indicadores, filtros, inadimplencia e relatorios por recebedor",
    inicio: "2026-10-28",
    fim: "2026-11-10",
    prioridade: "Media",
    responsavel: "Desenvolvimento / Produto",
    status: "Em andamento",
    dependencia: "Fases 6 a 10",
    obs: "Dashboard inicial implementado e lendo cadastros/cobrancas do repositorio. Relatorios exportaveis pendentes.",
  },
  {
    id: 12,
    fase: "Homologacao e lancamento",
    entrega: "Testes, LGPD, backups, deploy, monitoramento e treinamento",
    inicio: "2026-11-11",
    fim: "2026-11-24",
    prioridade: "Alta",
    responsavel: "Todos",
    status: "Nao iniciado",
    dependencia: "Fases 1 a 11",
    obs: "Rodar cenarios reais: pagamento em dia, atraso, abono, estorno e webhook duplicado.",
  },
];

const risks = [
  ["Alto", "Modelo Mercado Pago incorreto", "Repasses ou conciliacao podem ficar inviaveis", "Validar conta central, multiplas contas, OAuth ou marketplace/split antes do desenvolvimento"],
  ["Alto", "Webhook duplicado ou perdido", "Cobranca pode ficar com status incorreto", "Processamento idempotente, logs e reprocessamento manual"],
  ["Alto", "Permissoes mal separadas", "Recebedor ou inquilino pode ver dados indevidos", "Testes de autorizacao por perfil e contrato"],
  ["Medio", "Calculo incorreto de juros", "Cobranca indevida ou perda financeira", "Testes unitarios para multa, juros, carencia e abonos"],
  ["Medio", "Mensagens WhatsApp duplicadas", "Experiencia ruim para o inquilino", "Controle de envio por cobranca, evento e data"],
  ["Medio", "Cartao no MVP aumentar complexidade", "Atraso no lancamento", "Comecar com Pix e deixar cartao para fase posterior, se necessario"],
  ["Medio", "Armazenamento de documentos sensiveis", "Risco de LGPD e seguranca", "Controle de acesso, logs, backups e politica de retencao"],
];

const start = new Date("2026-07-01T00:00:00");
const weeks = Array.from({ length: 22 }, (_, i) => {
  const d = new Date(start);
  d.setDate(start.getDate() + i * 7);
  return d;
});

function dateValue(value) {
  return new Date(`${value}T00:00:00`);
}

function styleTitle(sheet, range, title) {
  const titleRange = sheet.getRange(range);
  titleRange.merge();
  titleRange.values = [[title]];
  titleRange.format = {
    fill: "#1F4E79",
    font: { bold: true, color: "#FFFFFF", size: 16 },
    horizontalAlignment: "left",
    verticalAlignment: "middle",
  };
  titleRange.format.rowHeight = 30;
}

function styleHeader(range) {
  range.format = {
    fill: "#D9EAF7",
    font: { bold: true, color: "#17365D" },
    wrapText: true,
    horizontalAlignment: "center",
    verticalAlignment: "middle",
    borders: { preset: "outside", style: "thin", color: "#A6A6A6" },
  };
}

function styleBody(range) {
  range.format = {
    wrapText: true,
    verticalAlignment: "top",
    borders: {
      insideHorizontal: { style: "thin", color: "#E7E6E6" },
      insideVertical: { style: "thin", color: "#E7E6E6" },
      top: { style: "thin", color: "#BFBFBF" },
      bottom: { style: "thin", color: "#BFBFBF" },
      left: { style: "thin", color: "#BFBFBF" },
      right: { style: "thin", color: "#BFBFBF" },
    },
  };
}

// Cronograma
styleTitle(cronograma, "A1:AI1", "Cronograma de Desenvolvimento - Aplicacao de Alugueis");
cronograma.getRange("A3:K3").values = [[
  "ID",
  "Fase",
  "Entrega principal",
  "Inicio",
  "Fim",
  "Semanas",
  "Prioridade",
  "Responsavel",
  "Status",
  "Dependencia",
  "Observacoes",
]];
styleHeader(cronograma.getRange("A3:K3"));

cronograma.getRange("A4:K15").values = phases.map((phase) => [
  phase.id,
  phase.fase,
  phase.entrega,
  dateValue(phase.inicio),
  dateValue(phase.fim),
  null,
  phase.prioridade,
  phase.responsavel,
  phase.status,
  phase.dependencia,
  phase.obs,
]);
cronograma.getRange("F4").formulas = [["=ROUNDUP((E4-D4+1)/7,0)"]];
cronograma.getRange("F4:F15").fillDown();
styleBody(cronograma.getRange("A4:K15"));
cronograma.getRange("D4:E15").format.numberFormat = "yyyy-mm-dd";
cronograma.getRange("F4:F15").format.numberFormat = "0";
cronograma.getRange("A3:K15").format.autofitColumns();
cronograma.getRange("B:B").format.columnWidth = 24;
cronograma.getRange("C:C").format.columnWidth = 45;
cronograma.getRange("H:H").format.columnWidth = 24;
cronograma.getRange("J:J").format.columnWidth = 20;
cronograma.getRange("K:K").format.columnWidth = 55;
cronograma.getRange("A4:K15").format.rowHeight = 46;

cronograma.getRange("M3:AI3").values = [["Linha do tempo semanal", ...weeks.map((_, i) => `S${i + 1}`)]];
styleHeader(cronograma.getRange("M3:AI3"));
cronograma.getRange("N4:AI4").values = [weeks.map((d) => d)];
cronograma.getRange("N4:AI4").format.numberFormat = "dd/mm";
cronograma.getRange("M5:M16").values = phases.map((phase) => [phase.fase]);
cronograma.getRange("N5").formulas = [["=IF(AND(N$4>=$D4,N$4<=$E4),\"x\",\"\")"]];
cronograma.getRange("N5:AI16").fillDown();
cronograma.getRange("N5:AI16").fillRight();
styleBody(cronograma.getRange("M4:AI16"));
cronograma.getRange("M:M").format.columnWidth = 24;
cronograma.getRange("N:AI").format.columnWidth = 4;
cronograma.getRange("N5:AI16").format = {
  horizontalAlignment: "center",
  verticalAlignment: "middle",
  fill: "#E2F0D9",
  font: { color: "#548235", bold: true },
  borders: { preset: "all", style: "thin", color: "#FFFFFF" },
};
cronograma.getRange("A3:K15").dataValidation = null;
cronograma.getRange("G4:G15").dataValidation = { rule: { type: "list", values: ["Alta", "Media", "Baixa"] } };
cronograma.getRange("I4:I15").dataValidation = { rule: { type: "list", values: ["Nao iniciado", "Em andamento", "Concluido", "Bloqueado"] } };
cronograma.freezePanes.freezeRows(3);
cronograma.freezePanes.freezeColumns(2);
cronograma.showGridLines = false;

// Resumo
styleTitle(resumo, "A1:H1", "Resumo Executivo do Projeto");
resumo.getRange("A3:B8").values = [
  ["Indicador", "Valor"],
  ["Total de fases", null],
  ["Fases concluidas", null],
  ["Fases em andamento", null],
  ["Fases bloqueadas", null],
  ["Conclusao estimada", null],
];
resumo.getRange("B4:B8").formulas = [
  ["=COUNTA(Cronograma!A4:A15)"],
  ["=COUNTIF(Cronograma!I4:I15,\"Concluido\")"],
  ["=COUNTIF(Cronograma!I4:I15,\"Em andamento\")"],
  ["=COUNTIF(Cronograma!I4:I15,\"Bloqueado\")"],
  ["=MAX(Cronograma!E4:E15)"],
];
styleHeader(resumo.getRange("A3:B3"));
styleBody(resumo.getRange("A4:B8"));
resumo.getRange("B8").format.numberFormat = "yyyy-mm-dd";
resumo.getRange("A10:D14").values = [
  ["Decisao pendente", "Por que importa", "Momento recomendado", "Status"],
  ["Modelo Mercado Pago", "Define se o pagamento vai para conta central, multiplas contas ou split", "Antes da Fase 2", "Pendente"],
  ["Stack do monolito", "Define produtividade, hospedagem e manutencao", "Fase 1", "Definido"],
  ["Provedor WhatsApp", "Define custo e regras de envio", "Antes da Fase 10", "Definido"],
  ["Cartao no MVP", "Pode aumentar escopo e prazo", "Antes da Fase 7", "Pendente"],
];
styleHeader(resumo.getRange("A10:D10"));
styleBody(resumo.getRange("A11:D14"));
resumo.getRange("A16:D22").values = [
  ["MVP recomendado", "Incluido?", "Observacao", "Prioridade"],
  ["Cadastros de imoveis, inquilinos e recebedores", "Sim", "Base para contratos e cobrancas", "Alta"],
  ["Contratos com recebedor definido", "Sim", "Regra central da aplicacao", "Alta"],
  ["Cobrancas mensais com multa e juros", "Sim", "Essencial para operacao", "Alta"],
  ["Mercado Pago Pix", "Sim", "Primeira integracao de pagamento", "Alta"],
  ["Portal do inquilino", "Sim", "Transparencia e autoatendimento", "Alta"],
  ["Cartao de credito", "Depois", "Pode ficar para fase posterior", "Media"],
];
styleHeader(resumo.getRange("A16:D16"));
styleBody(resumo.getRange("A17:D22"));
resumo.getRange("A:D").format.autofitColumns();
resumo.getRange("B:B").format.columnWidth = 18;
resumo.getRange("C:C").format.columnWidth = 42;
resumo.getRange("D:D").format.columnWidth = 18;
resumo.freezePanes.freezeRows(3);
resumo.showGridLines = false;

// Riscos
styleTitle(riscos, "A1:D1", "Riscos e Mitigacoes");
riscos.getRange("A3:D3").values = [["Impacto", "Risco", "Efeito possivel", "Mitigacao"]];
styleHeader(riscos.getRange("A3:D3"));
riscos.getRange("A4:D10").values = risks;
styleBody(riscos.getRange("A4:D10"));
riscos.getRange("A:D").format.autofitColumns();
riscos.getRange("B:B").format.columnWidth = 34;
riscos.getRange("C:C").format.columnWidth = 40;
riscos.getRange("D:D").format.columnWidth = 52;
riscos.getRange("A4:D10").format.rowHeight = 42;
riscos.getRange("A4:A10").dataValidation = { rule: { type: "list", values: ["Alto", "Medio", "Baixo"] } };
riscos.freezePanes.freezeRows(3);
riscos.showGridLines = false;

const overview = await workbook.inspect({
  kind: "sheet",
  include: "id,name",
  maxChars: 1200,
});
console.log(overview.ndjson);

const summaryCheck = await workbook.inspect({
  kind: "table",
  sheetId: "Resumo",
  range: "A3:B8",
  include: "values,formulas",
  maxChars: 1800,
});
console.log(summaryCheck.ndjson);

const errors = await workbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
  options: { useRegex: true, maxResults: 300 },
  summary: "final formula error scan",
});
console.log(errors.ndjson);

for (const sheetName of ["Resumo", "Cronograma", "Riscos"]) {
  const preview = await workbook.render({
    sheetName,
    autoCrop: "all",
    scale: 1,
    format: "png",
  });
  await fs.writeFile(
    path.join(qaDir, `${sheetName.toLowerCase()}.png`),
    new Uint8Array(await preview.arrayBuffer()),
  );
}

const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(path.join(outputDir, "cronograma-aplicacao-alugueis.xlsx"));

await fs.rm(path.join(outputDir, "cronograma-aplicacao-alugueis.xlsx.inspect.ndjson"), {
  force: true,
});
