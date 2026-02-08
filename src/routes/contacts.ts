import { Router, Request, Response } from "express";
import { prisma } from "../db/client.js";

export const contactsRouter = Router();

/**
 * Helper endpoint to fetch contact IDs for testing bulk actions.
 * GET /contacts?accountId=acc_001&limit=10
 */
contactsRouter.get("/", async (req: Request, res: Response) => {
  try {
    const accountId = req.query.accountId as string | undefined;
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 100);

    const contacts = await prisma.contact.findMany({
      where: accountId ? { accountId } : undefined,
      take: limit,
      select: { id: true, name: true, email: true },
    });

    res.json({ contacts });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to list contacts" });
  }
});
