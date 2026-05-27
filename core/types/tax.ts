/**
 * core/types/tax.ts
 *
 * Tax domain contracts.
 * DTO stubs — expand as service/module boundaries are formalized.
 */

export interface SAWTSubmissionPayload {
  datContent: string;
  datFilename: string;
  clientName: string;
  registeredName: string;
  tin: string;
  quarterNum: number;
  year: string;
  address: string;
}

export interface BatchEmailItem {
  client: {
    id: string;
    name: string;
    tin: string | null;
    last_name: string | null;
    first_name: string | null;
    middle_name: string | null;
    address: string | null;
  };
  datContent: string;
  datFilename: string;
  quarterNum: number;
}

export type SubmissionsMap = Record<string, string>;