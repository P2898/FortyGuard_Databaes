import { desc, eq } from "drizzle-orm";
import { assessments, InsertAssessment } from "../drizzle/schema";
import { getDb } from "./db";

export async function saveAssessment(input: InsertAssessment) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(assessments).values(input);
  return Number(result[0].insertId);
}

export async function listAssessments(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(assessments).where(eq(assessments.userId, userId)).orderBy(desc(assessments.analyzedAt)).limit(20);
}
