// ─────────────────────────────────────────────────────────────────────────────
// lib/sawt/atc-descriptions.ts
//
// BIR Alphanumeric Tax Code (ATC) descriptions for SAWT Excel report.
// Source: BIR Form 2307 January 2018 ENCS — Schedule of Alphanumeric Tax Codes
//
// Design principles:
//   • Pure static data — no logic, no dependencies
//   • Single source of truth for ATC descriptions
//   • Both WI (individual) and WC (corporate) variants included
// ─────────────────────────────────────────────────────────────────────────────

export const ATC_DESCRIPTIONS: Record<string, string> = {
  // ── Professionals ──
  WI010: "Professional fees (lawyers, CPAs, engineers, etc.) - gross income not exceeding P720,000",
  WC010: "Professional fees (lawyers, CPAs, engineers, etc.) - gross income not exceeding P720,000",
  WI011: "Professional fees (lawyers, CPAs, engineers, etc.) - gross income exceeding P720,000",
  WC011: "Professional fees (lawyers, CPAs, engineers, etc.) - gross income exceeding P720,000",

  // ── Professional entertainers ──
  WI020: "Professional entertainers - gross income not exceeding P720,000",
  WC020: "Professional entertainers - gross income not exceeding P720,000",
  WI021: "Professional entertainers - gross income exceeding P720,000",
  WC021: "Professional entertainers - gross income exceeding P720,000",

  // ── Professional athletes ──
  WI030: "Professional athletes - gross income not exceeding P720,000",
  WC030: "Professional athletes - gross income not exceeding P720,000",
  WI031: "Professional athletes - gross income exceeding P720,000",
  WC031: "Professional athletes - gross income exceeding P720,000",

  // ── Directors/producers ──
  WI040: "Directors and producers (movies, TV, radio, musical) - gross income not exceeding P720,000",
  WC040: "Directors and producers (movies, TV, radio, musical) - gross income not exceeding P720,000",
  WI041: "Directors and producers (movies, TV, radio, musical) - gross income exceeding P720,000",
  WC041: "Directors and producers (movies, TV, radio, musical) - gross income exceeding P720,000",

  // ── Management consultants ──
  WI050: "Management and technical consultants - gross income not exceeding P720,000",
  WC050: "Management and technical consultants - gross income not exceeding P720,000",
  WI051: "Management and technical consultants - gross income exceeding P720,000",
  WC051: "Management and technical consultants - gross income exceeding P720,000",

  // ── Bookkeeping ──
  WI060: "Business and bookkeeping agents and agencies - gross income not exceeding P720,000",
  WC060: "Business and bookkeeping agents and agencies - gross income not exceeding P720,000",
  WI061: "Business and bookkeeping agents and agencies - gross income exceeding P720,000",
  WC061: "Business and bookkeeping agents and agencies - gross income exceeding P720,000",

  // ── Insurance ──
  WI070: "Insurance agents and insurance adjusters - gross income not exceeding P720,000",
  WC070: "Insurance agents and insurance adjusters - gross income not exceeding P720,000",
  WI071: "Insurance agents and insurance adjusters - gross income exceeding P720,000",
  WC071: "Insurance agents and insurance adjusters - gross income exceeding P720,000",

  // ── Talent fees ──
  WI080: "Other recipients of talent fees - gross income not exceeding P720,000",
  WC080: "Other recipients of talent fees - gross income not exceeding P720,000",
  WI081: "Other recipients of talent fees - gross income exceeding P720,000",
  WC081: "Other recipients of talent fees - gross income exceeding P720,000",

  // ── Directors (non-employee) ──
  WI090: "Fees of directors who are not employees of the company",
  WC090: "Fees of directors who are not employees of the company",

  // ── Rentals ──
  WI100: "Rentals - real/personal properties, poles, satellites, transmission facilities, billboards",
  WC100: "Rentals - real/personal properties, poles, satellites, transmission facilities, billboards",

  // ── Film rentals ──
  WI110: "Cinematographic film rentals and other payments to resident individual owners",
  WC110: "Cinematographic film rentals and other payments to resident corporate owners",

  // ── Contractors ──
  WI120: "Income payments to prime contractors/sub-contractors",
  WC120: "Income payments to prime contractors/sub-contractors",

  // ── Estates & trusts ──
  WI130: "Income distribution to beneficiaries of estates and trusts",

  // ── Brokers ──
  WI140: "Gross commissions or service fees of brokers, agents of professional entertainers and RESPs - not exceeding P720,000",
  WC140: "Gross commissions or service fees of brokers, agents of professional entertainers and RESPs - not exceeding P720,000",

  // ── Medical practitioners ──
  WI150: "Professional fees paid to medical practitioners by hospitals/clinics/HMOs - not exceeding P720,000",
  WC150: "Professional fees paid to medical practitioners by hospitals/clinics/HMOs - not exceeding P720,000",
  WI151: "Professional fees paid to medical practitioners by hospitals/clinics/HMOs - exceeding P720,000",
  WC151: "Professional fees paid to medical practitioners by hospitals/clinics/HMOs - exceeding P720,000",

  // ── GPP partners ──
  WI152: "Payments to partners of general professional partnerships",

  // ── Medical/dental/vet via hospitals ──
  WI153: "Payments for medical/dental/veterinary services through hospitals/clinics/HMOs",

  // ── Credit card companies ──
  WI156: "Payments made by credit card companies",
  WC156: "Payments made by credit card companies",

  // ── Government suppliers ──
  WI157: "Income payments made by government and GOCCs to local/resident suppliers of goods and services",
  WC157: "Income payments made by government and GOCCs to local/resident suppliers of goods and services",

  // ── Top withholding agents - goods ──
  WI158: "Income payments made by top withholding agents to local/resident supplier of goods",
  WC158: "Income payments made by top withholding agents to local/resident supplier of goods",

  // ── Overtime - government personnel ──
  WI159: "Additional payments to government personnel from importers, shipping and airline companies for overtime",

  // ── Top withholding agents - services ──
  WI160: "Income payments made by top withholding agents to local/resident supplier of services",
  WC160: "Income payments made by top withholding agents to local/resident supplier of services",

  // ── MLM/distributors ──
  WI515: "Commissions to independent distributors, sales representatives and marketing agents - not exceeding P720,000",
  WC515: "Commissions to independent distributors, sales representatives and marketing agents - not exceeding P720,000",
  WI516: "Commissions to independent distributors, sales representatives and marketing agents - exceeding P720,000",
  WC516: "Commissions to independent distributors, sales representatives and marketing agents - exceeding P720,000",

  // ── Embalmers ──
  WI530: "Gross payments to embalmers by funeral parlors",

  // ── Pre-need / funeral ──
  WI535: "Payments made by pre-need companies to funeral parlors",
  WC535: "Payments made by pre-need companies to funeral parlors",

  // ── Tolling fees ──
  WI540: "Tolling fees paid to refineries",
  WC540: "Tolling fees paid to refineries",

  // ── Agricultural ──
  WI610: "Income payments made to suppliers of agricultural products",
  WC610: "Income payments made to suppliers of agricultural products",

  // ── Minerals ──
  WI630: "Income payments on purchases of minerals, mineral products and quarry resources",
  WC630: "Income payments on purchases of minerals, mineral products and quarry resources",

  // ── BSP gold ──
  WI640: "Income payments on purchases of minerals by Bangko Sentral ng Pilipinas",
  WC640: "Income payments on purchases of minerals by Bangko Sentral ng Pilipinas",

  // ── MERALCO ──
  WI650: "Gross amount of refund given by MERALCO to customers with active contracts",
  WC650: "Gross amount of refund given by MERALCO to customers with active contracts",
  WI651: "Gross amount of refund given by MERALCO to customers with terminated contracts",
  WC651: "Gross amount of refund given by MERALCO to customers with terminated contracts",
  WI660: "Interest on refund of meter deposit - residential customers exceeding 200 kwh (MERALCO)",
  WC660: "Interest on refund of meter deposit - residential customers exceeding 200 kwh (MERALCO)",
  WI661: "Interest on refund of meter deposit - non-residential customers exceeding 200 kwh (MERALCO)",
  WC661: "Interest on refund of meter deposit - non-residential customers exceeding 200 kwh (MERALCO)",
  WI662: "Interest on refund of meter deposit - residential customers (other DUs)",
  WC662: "Interest on refund of meter deposit - residential customers (other DUs)",
  WI663: "Interest on refund of meter deposit - non-residential customers (other DUs)",
  WC663: "Interest on refund of meter deposit - non-residential customers (other DUs)",

  // ── Campaign ──
  WI680: "Income payments made by political parties and candidates related to campaign expenditures",
  WC680: "Income payments made by political parties and candidates related to campaign expenditures",

  // ── REIT ──
  WI710: "Income payments received by Real Estate Investment Trust (REIT)",
  WC710: "Income payments received by Real Estate Investment Trust (REIT)",
};