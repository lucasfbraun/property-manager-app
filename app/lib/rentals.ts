export type PersonStatus = "Ativo" | "Inadimplente" | "Inativo";
export type ContractStatus = "Ativo" | "Vence em breve" | "Encerrado";
export type ChargeStatus = "Aberta" | "Vencida" | "Paga";
export type PaymentMethod = "Pix" | "Cartao" | "Manual";

/**
 * Lifecycle of the contract document/signature flow:
 * - not_generated: no template attached yet, nothing to sign.
 * - awaiting_signature: text generated from a template, tenant can download
 *   and needs to sign and upload it back.
 * - in_review: tenant uploaded a signed copy, waiting for admin approval.
 * - approved / rejected: admin decision. Rejected allows a new upload.
 */
export type SignatureStatus =
  | "not_generated"
  | "awaiting_signature"
  | "in_review"
  | "approved"
  | "rejected";

export function signatureStatusLabel(status: SignatureStatus): string {
  switch (status) {
    case "awaiting_signature":
      return "Aguardando assinatura";
    case "in_review":
      return "Em analise";
    case "approved":
      return "Aprovado";
    case "rejected":
      return "Rejeitado";
    default:
      return "Nao gerado";
  }
}

export type Receiver = {
  id: string;
  name: string;
  document: string;
  email: string;
  mpAccount: string;
  mpConnected: boolean;
  mpConnectedAt: string | null;
  /** null = never connected; true = live/production token; false = TEST (sandbox) token. */
  mpLiveMode: boolean | null;
  /** MP's own user_id for the connected account, returned by the OAuth token exchange. */
  mpUserId: string | null;
};

export type Tenant = {
  id: string;
  name: string;
  document: string;
  email: string;
  whatsapp: string;
  status: PersonStatus;
  /** Number of people living at the property, used to split rateios fairly. Null when not informed. */
  residentCount: number | null;
};

export type Property = {
  id: string;
  name: string;
  address: string;
  type: string;
  status: "Alugado" | "Disponivel" | "Manutencao";
};

export type Contract = {
  id: string;
  propertyId: string;
  tenantId: string;
  receiverId: string;
  monthlyRent: number;
  dueDay: number;
  startsAt: string;
  endsAt: string;
  fineRate: number;
  monthlyInterestRate: number;
  graceDays: number;
  status: ContractStatus;
  templateId: string | null;
  contractText: string | null;
  signatureStatus: SignatureStatus;
  signedFileName: string | null;
  signedUploadedAt: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  generatedDocumentKey: string | null;
  generatedDocumentUpdatedAt: string | null;
};

export type Charge = {
  id: string;
  contractId: string;
  reference: string;
  dueDate: string;
  amount: number;
  status: ChargeStatus;
  paidAt?: string;
  paymentMethod?: PaymentMethod;
  pixQrCode: string | null;
  pixQrCodeBase64: string | null;
  pixExpiresAt: string | null;
  /** Portion of `amount` that comes from a rateio (water, condominio, gas, etc. — rest is rent). Null when none was applied. */
  rateioAmount: number | null;
};

export type PaymentProjection = Charge & {
  tenant: Tenant;
  property: Property;
  receiver: Receiver;
  contract: Contract;
  daysLate: number;
  fine: number;
  interest: number;
  totalDue: number;
};

const businessDate = new Date("2026-06-28T12:00:00-03:00");

export const receivers: Receiver[] = [
  {
    id: "rec-lucas",
    name: "Lucas",
    document: "000.000.000-00",
    email: "lucas@example.com",
    mpAccount: "Mercado Pago Lucas",
    mpConnected: false,
    mpConnectedAt: null,
    mpLiveMode: null,
    mpUserId: null,
  },
  {
    id: "rec-guilherme",
    name: "Guilherme",
    document: "111.111.111-11",
    email: "guilherme@example.com",
    mpAccount: "Mercado Pago Guilherme",
    mpConnected: false,
    mpConnectedAt: null,
    mpLiveMode: null,
    mpUserId: null,
  },
];

export const tenants: Tenant[] = [
  {
    id: "ten-marina",
    name: "Marina Souza",
    document: "123.456.789-00",
    email: "marina@example.com",
    whatsapp: "+55 11 99999-0001",
    status: "Ativo",
    residentCount: 2,
  },
  {
    id: "ten-rafael",
    name: "Rafael Lima",
    document: "987.654.321-00",
    email: "rafael@example.com",
    whatsapp: "+55 11 99999-0002",
    status: "Inadimplente",
    residentCount: 3,
  },
  {
    id: "ten-carlos",
    name: "Carlos Mendes",
    document: "456.789.123-00",
    email: "carlos@example.com",
    whatsapp: "+55 11 99999-0003",
    status: "Ativo",
    residentCount: 1,
  },
];

export const properties: Property[] = [
  {
    id: "prop-centro",
    name: "Apartamento Centro",
    address: "Rua das Palmeiras, 120 - Centro",
    type: "Apartamento",
    status: "Alugado",
  },
  {
    id: "prop-jardim",
    name: "Casa Jardim",
    address: "Av. Brasil, 450 - Jardim",
    type: "Casa",
    status: "Alugado",
  },
  {
    id: "prop-sala",
    name: "Sala Comercial 304",
    address: "Rua XV, 88 - Comercial",
    type: "Comercial",
    status: "Alugado",
  },
];

export const contracts: Contract[] = [
  {
    id: "ctr-1001",
    propertyId: "prop-centro",
    tenantId: "ten-marina",
    receiverId: "rec-lucas",
    monthlyRent: 1800,
    dueDay: 5,
    startsAt: "2026-01-01",
    endsAt: "2026-12-31",
    fineRate: 0.02,
    monthlyInterestRate: 0.01,
    graceDays: 0,
    status: "Ativo",
    templateId: null,
    contractText: null,
    signatureStatus: "not_generated",
    signedFileName: null,
    signedUploadedAt: null,
    reviewedAt: null,
    reviewNote: null,
    generatedDocumentKey: null,
    generatedDocumentUpdatedAt: null,
  },
  {
    id: "ctr-1002",
    propertyId: "prop-jardim",
    tenantId: "ten-rafael",
    receiverId: "rec-guilherme",
    monthlyRent: 2450,
    dueDay: 10,
    startsAt: "2026-02-01",
    endsAt: "2027-01-31",
    fineRate: 0.02,
    monthlyInterestRate: 0.01,
    graceDays: 2,
    status: "Ativo",
    templateId: null,
    contractText: null,
    signatureStatus: "not_generated",
    signedFileName: null,
    signedUploadedAt: null,
    reviewedAt: null,
    reviewNote: null,
    generatedDocumentKey: null,
    generatedDocumentUpdatedAt: null,
  },
  {
    id: "ctr-1003",
    propertyId: "prop-sala",
    tenantId: "ten-carlos",
    receiverId: "rec-lucas",
    monthlyRent: 3200,
    dueDay: 5,
    startsAt: "2026-03-01",
    endsAt: "2026-09-30",
    fineRate: 0.02,
    monthlyInterestRate: 0.01,
    graceDays: 0,
    status: "Vence em breve",
    templateId: null,
    contractText: null,
    signatureStatus: "not_generated",
    signedFileName: null,
    signedUploadedAt: null,
    reviewedAt: null,
    reviewNote: null,
    generatedDocumentKey: null,
    generatedDocumentUpdatedAt: null,
  },
];

export const charges: Charge[] = [
  {
    id: "chg-2026-06-1001",
    contractId: "ctr-1001",
    reference: "Junho/2026",
    dueDate: "2026-06-05",
    amount: 1800,
    status: "Paga",
    paidAt: "2026-06-05",
    paymentMethod: "Pix",
    pixQrCode: null,
    pixQrCodeBase64: null,
    pixExpiresAt: null,
    rateioAmount: null,
  },
  {
    id: "chg-2026-06-1002",
    contractId: "ctr-1002",
    reference: "Junho/2026",
    dueDate: "2026-06-10",
    amount: 2450,
    status: "Vencida",
    pixQrCode: null,
    pixQrCodeBase64: null,
    pixExpiresAt: null,
    rateioAmount: null,
  },
  {
    id: "chg-2026-07-1003",
    contractId: "ctr-1003",
    reference: "Julho/2026",
    dueDate: "2026-07-05",
    amount: 3200,
    status: "Aberta",
    pixQrCode: null,
    pixQrCodeBase64: null,
    pixExpiresAt: null,
    rateioAmount: null,
  },
];

export function calculateCharge(charge: Charge, contract: Contract) {
  const due = new Date(`${charge.dueDate}T12:00:00-03:00`);
  const diffMs = businessDate.getTime() - due.getTime();
  const rawDaysLate = Math.max(0, Math.floor(diffMs / 86_400_000));
  const billableDaysLate =
    charge.status === "Paga" ? 0 : Math.max(0, rawDaysLate - contract.graceDays);
  const fine = billableDaysLate > 0 ? charge.amount * contract.fineRate : 0;
  const interest =
    billableDaysLate > 0
      ? charge.amount * (contract.monthlyInterestRate / 30) * billableDaysLate
      : 0;

  return {
    daysLate: billableDaysLate,
    fine,
    interest,
    totalDue: charge.status === "Paga" ? 0 : charge.amount + fine + interest,
  };
}

export function getDashboardData(data?: {
  tenants: Tenant[];
  properties: Property[];
  receivers: Receiver[];
  contracts: Contract[];
  charges?: Charge[];
}) {
  const activeContracts = data?.contracts ?? contracts;
  const activeTenants = data?.tenants ?? tenants;
  const activeProperties = data?.properties ?? properties;
  const activeReceivers = data?.receivers ?? receivers;
  const projections = getPaymentProjections({
    charges: data?.charges ?? charges,
    contracts: activeContracts,
    properties: activeProperties,
    receivers: activeReceivers,
    tenants: activeTenants,
  });
  const open = projections.filter((charge) => charge.status !== "Paga");
  const paid = projections.filter((charge) => charge.status === "Paga");
  const overdue = projections.filter((charge) => charge.status === "Vencida");

  return {
    projections,
    totals: {
      expected: projections.reduce((sum, charge) => sum + charge.amount, 0),
      received: paid.reduce((sum, charge) => sum + charge.amount, 0),
      open: open.reduce((sum, charge) => sum + charge.totalDue, 0),
      overdue: overdue.reduce((sum, charge) => sum + charge.totalDue, 0),
      contracts: activeContracts.filter((contract) => contract.status !== "Encerrado")
        .length,
      tenantsWithDelay: new Set(overdue.map((charge) => charge.tenant.id)).size,
    },
    byReceiver: activeReceivers.map((receiver) => {
      const receiverCharges = projections.filter(
        (charge) => charge.receiver.id === receiver.id,
      );
      return {
        receiver,
        expected: receiverCharges.reduce((sum, charge) => sum + charge.amount, 0),
        received: receiverCharges
          .filter((charge) => charge.status === "Paga")
          .reduce((sum, charge) => sum + charge.amount, 0),
        open: receiverCharges
          .filter((charge) => charge.status !== "Paga")
          .reduce((sum, charge) => sum + charge.totalDue, 0),
      };
    }),
  };
}

export function getPaymentProjections(data?: {
  tenants: Tenant[];
  properties: Property[];
  receivers: Receiver[];
  contracts: Contract[];
  charges?: Charge[];
}): PaymentProjection[] {
  const activeContracts = data?.contracts ?? contracts;
  const activeTenants = data?.tenants ?? tenants;
  const activeProperties = data?.properties ?? properties;
  const activeReceivers = data?.receivers ?? receivers;
  const activeCharges = data?.charges ?? charges;

  return activeCharges.flatMap((charge) => {
    const contract = activeContracts.find((item) => item.id === charge.contractId);
    if (!contract) {
      return [];
    }
    const tenant = findById(activeTenants, contract.tenantId);
    const property = findById(activeProperties, contract.propertyId);
    const receiver = findById(activeReceivers, contract.receiverId);
    return {
      ...charge,
      tenant,
      property,
      receiver,
      contract,
      ...calculateCharge(charge, contract),
    };
  });
}

export function getTenantPortalData(
  tenantId = "ten-rafael",
  data?: {
    tenants: Tenant[];
    properties: Property[];
    receivers: Receiver[];
    contracts: Contract[];
    charges?: Charge[];
  },
) {
  const activeContracts = data?.contracts ?? contracts;
  const activeTenants = data?.tenants ?? tenants;
  const activeProperties = data?.properties ?? properties;
  const activeReceivers = data?.receivers ?? receivers;
  const activeCharges = data?.charges ?? charges;
  const tenant = findById(activeTenants, tenantId);
  const tenantContracts = activeContracts.filter(
    (contract) => contract.tenantId === tenant.id,
  );
  const tenantCharges = getPaymentProjections({
    charges: activeCharges,
    contracts: activeContracts,
    properties: activeProperties,
    receivers: activeReceivers,
    tenants: activeTenants,
  }).filter((charge) =>
    tenantContracts.some((contract) => contract.id === charge.contractId),
  );

  return {
    tenant,
    contracts: tenantContracts.map((contract) => ({
      ...contract,
      property: findById(activeProperties, contract.propertyId),
      receiver: findById(activeReceivers, contract.receiverId),
    })),
    charges: tenantCharges,
  };
}

export function getReceiverPortalData(
  receiverId: string,
  data?: {
    tenants: Tenant[];
    properties: Property[];
    receivers: Receiver[];
    contracts: Contract[];
    charges?: Charge[];
  },
) {
  const activeContracts = data?.contracts ?? contracts;
  const activeTenants = data?.tenants ?? tenants;
  const activeProperties = data?.properties ?? properties;
  const activeReceivers = data?.receivers ?? receivers;
  const activeCharges = data?.charges ?? charges;
  const receiver = findById(activeReceivers, receiverId);
  const receiverContracts = activeContracts.filter(
    (contract) => contract.receiverId === receiver.id,
  );
  const receiverCharges = getPaymentProjections({
    charges: activeCharges,
    contracts: activeContracts,
    properties: activeProperties,
    receivers: activeReceivers,
    tenants: activeTenants,
  }).filter((charge) => charge.receiver.id === receiver.id);
  const paidCharges = receiverCharges.filter((charge) => charge.status === "Paga");
  const openCharges = receiverCharges.filter((charge) => charge.status !== "Paga");

  return {
    receiver,
    contracts: receiverContracts.map((contract) => ({
      ...contract,
      property: findById(activeProperties, contract.propertyId),
      tenant: findById(activeTenants, contract.tenantId),
    })),
    charges: receiverCharges,
    totals: {
      expected: receiverCharges.reduce((sum, charge) => sum + charge.amount, 0),
      open: openCharges.reduce((sum, charge) => sum + charge.totalDue, 0),
      received: paidCharges.reduce((sum, charge) => sum + charge.amount, 0),
    },
  };
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
  }).format(new Date(`${value}T12:00:00-03:00`));
}

function findById<T extends { id: string }>(items: T[], id: string): T {
  const item = items.find((candidate) => candidate.id === id);
  if (!item) {
    throw new Error(`Registro nao encontrado: ${id}`);
  }
  return item;
}
