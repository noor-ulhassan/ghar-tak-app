import { pathToFileURL } from "node:url";
import { sql } from "drizzle-orm";
import { db, pool } from "./index";

const NUMBER = "[0-9]+(?:[.][0-9]+)?";

/**
 * Copies the old free-text delivery radius ("5 km") into delivery_radius_km.
 * Only a plain "<number> km" from 0.5 to 50 is copied (the limits in @workspace/geo);
 * anything else is reported and left for the seller to set. Rows that already have
 * delivery_radius_km are never touched, so it is safe to run again.
 */
export async function backfillDeliveryRadius() {
  const updated = await db.execute(sql`
    UPDATE providers
    SET delivery_radius_km = substring(delivery_radius from ${NUMBER})::numeric
    WHERE delivery_radius_km IS NULL
      AND delivery_radius ~* ${`^[[:space:]]*${NUMBER}[[:space:]]*km[[:space:]]*$`}
      AND substring(delivery_radius from ${NUMBER})::numeric BETWEEN 0.5 AND 50
    RETURNING id
  `);
  const skipped = await db.execute<{ id: string; name: string; delivery_radius: string }>(sql`
    SELECT id, name, delivery_radius FROM providers
    WHERE delivery_radius_km IS NULL AND trim(coalesce(delivery_radius, '')) <> ''
    ORDER BY name
  `);
  return { updated: updated.rows.length, skipped: skipped.rows };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  backfillDeliveryRadius()
    .then(({ updated, skipped }) => {
      console.log(`Copied the delivery radius of ${updated} provider(s).`);
      for (const row of skipped) {
        console.log(`Not copied, the seller needs to set it: ${row.name} (${row.id}): "${row.delivery_radius}"`);
      }
    })
    .catch((err) => {
      console.error(err);
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}
