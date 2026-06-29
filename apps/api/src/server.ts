import cors from "@fastify/cors";
import Fastify from "fastify";
import { registerAdminAuth } from "./auth.js";
import { generationRoutes } from "./routes/generations.js";
import { healthRoutes } from "./routes/health.js";
import { hookRoutes } from "./routes/hooks.js";
import { packageRoutes } from "./routes/packages.js";
import { paymentRoutes } from "./routes/payments.js";
import { presetRoutes } from "./routes/presets.js";
import { projectRoutes } from "./routes/projects.js";
import { templateRoutes } from "./routes/templates.js";
import { userRoutes } from "./routes/users.js";

const app = Fastify({ logger: true });

await app.register(cors, { origin: true });
await registerAdminAuth(app);
await app.register(healthRoutes);
await app.register(userRoutes, { prefix: "/admin" });
await app.register(packageRoutes, { prefix: "/admin" });
await app.register(paymentRoutes, { prefix: "/admin" });
await app.register(generationRoutes, { prefix: "/admin" });
await app.register(presetRoutes, { prefix: "/admin" });
await app.register(projectRoutes, { prefix: "/admin" });
await app.register(templateRoutes, { prefix: "/admin" });
await app.register(hookRoutes, { prefix: "/admin" });

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? "127.0.0.1";

await app.listen({ port, host });
