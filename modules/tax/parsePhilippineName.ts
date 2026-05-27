/**
 * modules/tax/parsePhilippineName.ts
 *
 * Pure function — no AI, no DB, no React.
 * Parses Philippine name formats as they appear on BIR 2307 forms.
 *
 * Handles:
 * - "LAST, FIRST MIDDLE"
 * - "LAST, FIRST COMPOUND MIDDLE" (compound first names)
 * - "LAST, FIRST MIDDLE / BUSINESS NAME" (individual + business)
 * - "BUSINESS NAME ONLY" (no comma = non-individual)
 */

export interface ParsedName {
  last_name: string | null;
  first_name: string | null;
  middle_name: string | null;
  business_name: string | null;
  is_individual: boolean;
}

export function parsePhilippineName(rawName: string): ParsedName {
  if (!rawName || !rawName.trim()) {
    return {
      last_name: null,
      first_name: null,
      middle_name: null,
      business_name: null,
      is_individual: false,
    };
  }

  const cleaned = rawName.trim().toUpperCase();

  // 1. Separate individual name from business name if slash present
  // e.g. "AUSA, JOVITA OLIMON / JOVITA DATA PROCESSING SERVICES"
  const slashIndex = cleaned.indexOf("/");
  const individualPart = slashIndex !== -1
    ? cleaned.slice(0, slashIndex).trim()
    : cleaned;
  const businessPart = slashIndex !== -1
    ? cleaned.slice(slashIndex + 1).trim()
    : null;

  // 2. Check if individual part has a comma — indicates "LAST, FIRST MIDDLE" format
  const commaIndex = individualPart.indexOf(",");
  if (commaIndex === -1) {
    // No comma = non-individual (business/corporation only)
    return {
      last_name: null,
      first_name: null,
      middle_name: null,
      business_name: cleaned,
      is_individual: false,
    };
  }

  // 3. Split into last name and given names
  const lastName = individualPart.slice(0, commaIndex).trim();
  const givenNames = individualPart.slice(commaIndex + 1).trim();

  if (!givenNames) {
    return {
      last_name: lastName || null,
      first_name: null,
      middle_name: null,
      business_name: businessPart,
      is_individual: true,
    };
  }

  // 4. Split given names into words
  // Last word = middle name, everything before = first name (may be compound)
  const words = givenNames.split(/\s+/).filter(Boolean);

  if (words.length === 0) {
    return {
      last_name: lastName || null,
      first_name: null,
      middle_name: null,
      business_name: businessPart,
      is_individual: true,
    };
  }

  if (words.length === 1) {
    // Only one word after comma = first name only, no middle name
    return {
      last_name: lastName || null,
      first_name: words[0],
      middle_name: null,
      business_name: businessPart,
      is_individual: true,
    };
  }

  // 5. Multiple words: last word = middle name, rest = first name
  const middleName = words[words.length - 1];
  const firstName = words.slice(0, words.length - 1).join(" ");

  return {
    last_name: lastName || null,
    first_name: firstName || null,
    middle_name: middleName || null,
    business_name: businessPart,
    is_individual: true,
  };
}