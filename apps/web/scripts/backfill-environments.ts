#!/usr/bin/env bun
/**
 * Backfill script: creates a "Production" environment for each existing
 * project and assigns all existing collection items to it.
 *
 * This is a one-time migration for projects created before the environment
 * feature was introduced.
 *
 * Usage: bun run scripts/backfill-environments.ts
 */

import { db } from "@/db";
import { projects } from "@/db/schema/projects";
import { collections } from "@/db/schema/collections";
import { collectionItems } from "@/db/schema/collection-items";
import { environments } from "@/db/schema/environments";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { nanoid } from "nanoid";

async function main() {
  console.log("🔍 Looking for projects without environments...");

  const allProjects = await db.select().from(projects);

  if (allProjects.length === 0) {
    console.log("No projects found. Nothing to backfill.");
    return;
  }

  console.log(`Found ${allProjects.length} project(s).`);
  let totalBackfilled = 0;

  for (const project of allProjects) {
    console.log(`\n📦 Project "${project.name}" (${project.id})`);

    // Check if project already has a production environment
    let prodEnv = await db.query.environments.findFirst({
      where: and(
        eq(environments.projectId, project.id),
        eq(environments.isProduction, true),
      ),
    });

    if (!prodEnv) {
      // Check if project has any environments at all
      const existingEnvs = await db.query.environments.findMany({
        where: eq(environments.projectId, project.id),
      });

      if (existingEnvs.length > 0) {
        // Mark the first one as production
        prodEnv = existingEnvs[0];
        await db
          .update(environments)
          .set({ isProduction: true, updatedAt: new Date().toISOString() })
          .where(eq(environments.id, prodEnv.id));
        console.log(`  ✅ Marked existing env "${prodEnv.name}" as production`);
      } else {
        // Create a new production environment
        const now = new Date().toISOString();
        const id = nanoid();
        await db.insert(environments).values({
          id,
          projectId: project.id,
          name: "Production",
          slug: "production",
          isProduction: true,
          createdAt: now,
          updatedAt: now,
        });
        prodEnv = { id, projectId: project.id, name: "Production", slug: "production", isProduction: true, createdAt: now, updatedAt: now };
        console.log(`  ✅ Created production environment "${prodEnv.name}"`);
      }
    } else {
      console.log(`  ✅ Production environment already exists: "${prodEnv.name}"`);
    }

    // Find items in this project's collections that have no environment_id
    const unassignedItems = await db
      .select({ id: collectionItems.id })
      .from(collectionItems)
      .innerJoin(collections, eq(collectionItems.collectionId, collections.id))
      .where(
        and(
          eq(collections.projectId, project.id),
          isNull(collectionItems.environmentId),
        ),
      );

    if (unassignedItems.length === 0) {
      console.log(`  ✅ All items already have an environment assigned.`);
      continue;
    }

    const ids = unassignedItems.map((r) => r.id);
    console.log(`  → Assigning ${ids.length} item(s) to "${prodEnv.name}"...`);

    // Batch update in chunks of 50
    const chunkSize = 50;
    for (let i = 0; i < ids.length; i += chunkSize) {
      const chunk = ids.slice(i, i + chunkSize);
      await db
        .update(collectionItems)
        .set({ environmentId: prodEnv.id })
        .where(inArray(collectionItems.id, chunk));
    }

    console.log(`  ✅ ${ids.length} item(s) backfilled.`);
    totalBackfilled += ids.length;
  }

  console.log(`\n🎉 Backfill complete! ${totalBackfilled} total item(s) assigned to production environments.`);
}

main().catch((err) => {
  console.error("❌ Backfill failed:", err);
  process.exit(1);
});
