import { asc, inArray } from 'drizzle-orm';
import { db } from '../src/database/postgres/client.js';
import { auditLogs, osWorkflow } from '../src/database/postgres/schema.js';

const ids = [
  '03e67bb3-5413-4e83-b91f-bc2a9ee34cc4',
  'e0494b16-d2f1-4eae-a1ca-53b1b11a3966',
];

async function main() {
  const [workflow, audit] = await Promise.all([
    db.select().from(osWorkflow).where(inArray(osWorkflow.id, ids)).orderBy(asc(osWorkflow.createdAt)),
    db.select({ entityId: auditLogs.entityId, event: auditLogs.event, changes: auditLogs.changes, createdAt: auditLogs.createdAt })
      .from(auditLogs)
      .where(inArray(auditLogs.entityId, ids))
      .orderBy(asc(auditLogs.createdAt)),
  ]);
  console.log(JSON.stringify({ workflow, audit }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
