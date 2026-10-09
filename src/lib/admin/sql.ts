import "server-only";
import { getSqlGateway, type SqlFunction } from "@/lib/sql-gateway";
import { assertSyntheticReviewDatabase } from "@/lib/admin/review-guard";

// The one way the admin application reaches the database. Every call passes the
// review guard first: on a Preview of the admin application, only the synthetic
// review database may answer. Callers must have passed requireAdmin().
export function adminSql() {
  const gateway = getSqlGateway();
  return {
    async call<T = unknown>(fn: SqlFunction, args?: Record<string, unknown>): Promise<T> {
      await assertSyntheticReviewDatabase();
      return gateway.call<T>(fn, args);
    },
  };
}
