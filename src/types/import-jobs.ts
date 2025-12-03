export type ImportJobStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";

export type ImportJobDto = {
  id: string;
  status: ImportJobStatus;
  totalRows: number;
  processedRows: number;
  errorMessage?: string | null;
  dedupKey: string;
  filename?: string | null;
  createdAt: string;
};
