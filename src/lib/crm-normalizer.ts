export type InternalRecordType = "lead" | "contact" | "company";

export type InternalFieldContract = {
  key: string;
  label: string;
  description?: string;
  required?: boolean;
};

export type InternalFieldMap = Record<InternalRecordType, InternalFieldContract[]>;

export const internalFieldContract: InternalFieldMap = {
  lead: [
    { key: "status", label: "Status do lead", description: "Lead status/lifecycle stage.", required: true },
    { key: "source", label: "Origem", description: "Origem ou campanha." },
    { key: "owner", label: "Responsável", description: "Usuário responsável pelo lead." },
  ],
  contact: [
    { key: "firstName", label: "Nome", required: true },
    { key: "lastName", label: "Sobrenome" },
    { key: "fullName", label: "Nome completo" },
    { key: "email", label: "E-mail", description: "E-mail principal.", required: true },
    { key: "phone", label: "Telefone" },
    { key: "jobTitle", label: "Cargo" },
  ],
  company: [
    { key: "name", label: "Empresa", required: true },
    { key: "domain", label: "Domínio" },
    { key: "size", label: "Tamanho" },
    { key: "industry", label: "Segmento" },
  ],
};

export type CrmProvider = "hubspot" | "pipedrive";

export const crmFieldMappings: Record<CrmProvider, Record<InternalRecordType, Record<string, string[]>>> = {
  hubspot: {
    lead: {
      status: ["hs_lead_status", "lead status", "lifecyclestage"],
      source: ["source", "utm_source", "original source"],
      owner: ["hubspot owner", "hubspot_owner_id", "owner"],
    },
    contact: {
      firstName: ["firstname", "first name"],
      lastName: ["lastname", "last name"],
      fullName: ["name", "contact name"],
      email: ["email", "email address"],
      phone: ["phone", "mobilephone", "mobile"],
      jobTitle: ["jobtitle", "job title", "title"],
    },
    company: {
      name: ["company", "company name"],
      domain: ["domain", "website"],
      size: ["numberofemployees", "employees", "team size"],
      industry: ["industry", "segment"],
    },
  },
  pipedrive: {
    lead: {
      status: ["status", "stage"],
      source: ["source", "lead source"],
      owner: ["owner_id", "owner name", "user"],
    },
    contact: {
      firstName: ["first_name", "firstname"],
      lastName: ["last_name", "lastname"],
      fullName: ["person", "contact"],
      email: ["email", "email[0].value"],
      phone: ["phone", "phone[0].value"],
      jobTitle: ["label", "job title"],
    },
    company: {
      name: ["organization", "org_name", "company"],
      domain: ["org_domain", "domain"],
      size: ["org_size", "company size"],
      industry: ["industry", "org_industry"],
    },
  },
};

export type HeaderMapping = Record<string, InternalFieldTarget>;

export type InternalFieldTarget = `${InternalRecordType}.${string}`;

export type ManualMapping = HeaderMapping;

export interface NormalizationError {
  row: number;
  field: InternalFieldTarget | "unmapped";
  message: string;
  value?: unknown;
}

export interface NormalizedRow {
  lead: Partial<Record<string, string>>;
  contact: Partial<Record<string, string>>;
  company: Partial<Record<string, string>>;
}

export interface NormalizationResult {
  rows: NormalizedRow[];
  errors: NormalizationError[];
  unmatchedHeaders: string[];
  detectedProvider: CrmProvider | null;
}

export function normalizeHeader(header: string) {
  return header.trim().toLowerCase();
}

function buildProviderDictionary(provider: CrmProvider | null) {
  if (!provider) return {} as Record<string, InternalFieldTarget>;

  const dictionary: Record<string, InternalFieldTarget> = {};
  const providerMapping = crmFieldMappings[provider];

  (Object.keys(providerMapping) as InternalRecordType[]).forEach((recordType) => {
    const fields = providerMapping[recordType];
    Object.entries(fields).forEach(([internalKey, aliases]) => {
      aliases.forEach((alias) => {
        dictionary[normalizeHeader(alias)] = `${recordType}.${internalKey}`;
      });
    });
  });

  return dictionary;
}

export function detectCrmProvider(options: {
  selectedOption?: CrmProvider | null;
  csvHeaders?: string[];
  requestHeaders?: Record<string, string | undefined>;
}): CrmProvider | null {
  if (options.selectedOption) return options.selectedOption;

  const headerHint = options.requestHeaders?.["x-crm-provider"]?.toLowerCase();
  if (headerHint === "hubspot" || headerHint === "pipedrive") return headerHint;

  const headers = options.csvHeaders?.map(normalizeHeader) ?? [];
  if (!headers.length) return null;

  const scores: Record<CrmProvider, number> = { hubspot: 0, pipedrive: 0 };
  (Object.keys(crmFieldMappings) as CrmProvider[]).forEach((provider) => {
    const dictionary = buildProviderDictionary(provider);
    headers.forEach((header) => {
      if (dictionary[header]) scores[provider] += 1;
    });
  });

  const bestMatch = (Object.entries(scores).sort(([, a], [, b]) => b - a)[0] ?? [null, 0]) as [CrmProvider | null, number];
  return bestMatch[1] > 0 ? bestMatch[0] : null;
}

export function resolveHeaderMapping({
  provider,
  headers,
  manualMapping = {},
}: {
  provider: CrmProvider | null;
  headers: string[];
  manualMapping?: ManualMapping;
}): { mapping: HeaderMapping; unmatchedHeaders: string[] } {
  const dictionary = buildProviderDictionary(provider);
  const mapping: HeaderMapping = {};
  const unmatched: string[] = [];

  headers.forEach((header) => {
    const normalized = normalizeHeader(header);
    const manualTarget = manualMapping[header];
    if (manualTarget) {
      mapping[header] = manualTarget;
      return;
    }

    const automaticTarget = dictionary[normalized];
    if (automaticTarget) {
      mapping[header] = automaticTarget;
    } else {
      unmatched.push(header);
    }
  });

  return { mapping, unmatchedHeaders: unmatched };
}

export function normalizeCsvRows(
  rows: Record<string, string | number | null | undefined>[],
  options: { provider: CrmProvider | null; manualMapping?: ManualMapping }
): NormalizationResult {
  const headers = Array.from(new Set(rows.flatMap((row) => Object.keys(row ?? {}))));
  const detectedProvider = options.provider;
  const { mapping, unmatchedHeaders } = resolveHeaderMapping({
    provider: detectedProvider,
    headers,
    manualMapping: options.manualMapping,
  });

  const errors: NormalizationError[] = [];
  const normalizedRows: NormalizedRow[] = rows.map((row, rowIndex) => {
    const normalized: NormalizedRow = { lead: {}, contact: {}, company: {} };

    Object.entries(row).forEach(([header, value]) => {
      const target = mapping[header];
      if (!target) return;
      const [recordType, fieldKey] = target.split(".") as [InternalRecordType, string];
      normalized[recordType][fieldKey] = value?.toString?.() ?? "";
    });

    (Object.entries(internalFieldContract) as [InternalRecordType, InternalFieldContract[]][]).forEach(
      ([recordType, fields]) => {
        fields
          .filter((field) => field.required)
          .forEach((field) => {
            const hasValue = Boolean(normalized[recordType][field.key]);
            if (!hasValue) {
              errors.push({
                row: rowIndex + 1,
                field: `${recordType}.${field.key}`,
                message: "Campo obrigatório ausente após normalização.",
                value: row,
              });
            }
          });
      }
    );

    return normalized;
  });

  unmatchedHeaders.forEach((header) => {
    errors.push({
      row: 0,
      field: "unmapped",
      message: `Header "${header}" não foi mapeado automaticamente.`,
    });
  });

  return { rows: normalizedRows, errors, unmatchedHeaders, detectedProvider };
}

export function availableInternalTargets(): InternalFieldTarget[] {
  const targets: InternalFieldTarget[] = [];
  (Object.entries(internalFieldContract) as [InternalRecordType, InternalFieldContract[]][]).forEach(
    ([recordType, fields]) => {
      fields.forEach((field) => targets.push(`${recordType}.${field.key}`));
    }
  );
  return targets;
}

export function describeTarget(target: InternalFieldTarget) {
  const [recordType, key] = target.split(".") as [InternalRecordType, string];
  const field = internalFieldContract[recordType].find((item) => item.key === key);
  return field?.label ?? target;
}
