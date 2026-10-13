import { pool } from "../../src/adapters/database/client.js";

export async function clearLeadsTable(): Promise<void> {
  await pool.query("TRUNCATE TABLE leads CASCADE;");
}

export async function getLeadCount(): Promise<number> {
  const result = await pool.query<{ count: string }>(
    "SELECT COUNT(*) AS count FROM leads;",
  );
  return parseInt(result.rows[0]?.count ?? "0", 10);
}
