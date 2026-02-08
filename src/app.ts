import express from "express";
import cors from "cors";
import { bulkActionsRouter } from "./routes/bulk-actions.js";
import { contactsRouter } from "./routes/contacts.js";

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  app.use("/contacts", contactsRouter);
  app.use("/bulk-actions", bulkActionsRouter);

  return app;
}
