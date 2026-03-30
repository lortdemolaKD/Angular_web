import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { connectDb } from "./db.js";
import { Location } from "./models/Location.js";
import { authRouter } from "./auth.js";
import companiesRouter from "./routes/companies.routes.js";
import accountsRouter from "./routes/accounts.routes.js";
import locationsRouter from "./routes/locations.routes.js";
import performanceSetsRouter from "./routes/performanceSets.routes.js";
import setupRouter from "./routes/setup.routes.js";
import performanceTemplatesRouter from "./routes/performanceTemplates.routes.js";
import { attachUser } from "./middleware/auth.middleware.js";
import customAuditTemplatesRouter from './routes/customAuditTemplates.routes.js';
const app = express();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.use(cors());
app.use(express.json());

app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));

app.get("/api/health", (req, res) => res.json({ ok: true }));
app.use(attachUser);
app.use("/api/auth", authRouter);
import dashboardRouter from "./routes/dashboard.routes.js";
app.use("/api/dashboard", dashboardRouter);
import auditTemplatesRoutes from "./routes/auditTemplates.routes.js";
import auditsRoutes from "./routes/audits.routes.js";

app.use("/api/auditTemplates", auditTemplatesRoutes);
app.use("/api/audits", auditsRoutes);

app.use('/api/customAuditTemplates', customAuditTemplatesRouter);
app.use("/api/companies", companiesRouter);
app.use("/api/accounts", accountsRouter);
app.use("/api/locations", locationsRouter);
app.use("/api/setup", setupRouter);
app.use("/api/performanceSets", performanceSetsRouter);

app.use("/api/performance-templates", performanceTemplatesRouter);

await connectDb();
try {
  await Location.syncIndexes();
} catch (e) {
  console.warn("[Location.syncIndexes]", e?.message ?? e);
}
app.listen(process.env.PORT || 3000, () => console.log("API running"));
