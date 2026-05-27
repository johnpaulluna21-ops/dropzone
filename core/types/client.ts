/**
 * core/types/client.ts
 *
 * Client domain contracts.
 * Raw DB objects should never leak beyond the service layer.
 */

export interface ClientRecord {
  id: string;
  name: string;
  tin: string | null;
  tax_type: "8%" | "graduated";
  last_name: string | null;
  first_name: string | null;
  middle_name: string | null;
  rdo_code: string | null;
  address: string | null;
}

export interface ClientSummaryDTO {
  client: ClientRecord;
  totalForms: number;
  priorCredit: number;
  quarters: QuarterSummaryDTO[];
}

export interface QuarterSummaryDTO {
  quarter: "Q1" | "Q2" | "Q3" | "Q4";
  forms: number;
  manualCount: number;
  item47: number;
  item50: number;
  item51: number;
  item52: number;
  item53: number;
  item54: number;
  item55: number;
  item56: number;
  item57: number;
  item58: number;
  item62: number;
  item63: number;
  paid: number;
  isNoTaxDue: boolean;
  isOverpayment: boolean;
  rawForms: unknown[];
}