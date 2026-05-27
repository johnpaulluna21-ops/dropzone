/**
 * services/client/
 *
 * Future home of all client-domain service functions.
 * Currently client DB calls are scattered inside app/admin/tax/page.tsx.
 *
 * Planned files (Step 2):
 *   fetchClients.ts
 *   createClient.ts
 *   updateClient.ts
 *   fetchClientEditData.ts
 *
 * RULE: No Supabase calls anywhere except inside this folder.
 * RULE: Returns typed DTOs — ClientRecord, not raw Supabase rows.
 * RULE: One file per operation.
 */

export {};