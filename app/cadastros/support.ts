/** Helpers compartilhados pelos componentes do workspace de cadastros. */

export function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Erro inesperado.";
}

export function reminderEventLabel(event: string | undefined) {
  switch (event) {
    case "before_due":
      return "antes do vencimento";
    case "due_day":
      return "vencimento hoje";
    case "after_due":
      return "atraso";
    case "payment_confirmed":
      return "pagamento confirmado";
    case "contract_expiring":
      return "contrato vencendo";
    default:
      return "lembrete";
  }
}
