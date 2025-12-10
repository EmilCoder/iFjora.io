import fastify from "fastify";
import cors from "@fastify/cors";
import argon2 from "argon2";
import jwt from "jsonwebtoken";
import { prisma, disconnectDatabase } from "./db.js";
const app = fastify({ logger: true });
const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) {
    throw new Error("JWT_SECRET mangler i .env");
}
const jwtSecretValue = jwtSecret;
await app.register(cors, {
    origin: true,
});
function simulateAiAnalysis(title, content) {
    const baseScore = 60 + Math.floor(Math.random() * 36); // 60-95
    const strengthsPool = [
        "Klar problemformulering",
        "Konkrete brukere",
        "Mulig teknisk løsning",
        "Skalerbar idé",
        "Enkel å teste",
    ];
    const weaknessesPool = [
        "Uavklart målgruppe",
        "Manglende datagrunnlag",
        "Behov for mer validering",
        "Potensielt høy kost",
        "Utydelig differensiering",
    ];
    const strengths = strengthsPool.sort(() => 0.5 - Math.random()).slice(0, 2);
    const weaknesses = weaknessesPool.sort(() => 0.5 - Math.random()).slice(0, 2);
    return {
        score: baseScore,
        strengths,
        weaknesses,
        summary: `Foreløpig vurdering av "${title}": lovende, men krever videre utforskning.`,
    };
}
function issueToken(payload) {
    return jwt.sign(payload, jwtSecretValue, { expiresIn: "7d" });
}
async function requireUser(request, reply) {
    const auth = request.headers.authorization;
    if (!auth?.startsWith("Bearer ")) {
        reply.code(401).send({ message: "Mangler bearer-token." });
        return;
    }
    const token = auth.slice("Bearer ".length);
    try {
        const decoded = jwt.verify(token, jwtSecretValue);
        if (decoded &&
            typeof decoded === "object" &&
            "id" in decoded &&
            "email" in decoded) {
            const userPayload = {
                id: decoded.id,
                email: decoded.email,
                isAdmin: decoded.isAdmin ?? false,
            };
            request.user = userPayload;
            return userPayload;
        }
        reply.code(401).send({ message: "Ugyldig token." });
        return;
    }
    catch (err) {
        request.log.warn({ err }, "Ugyldig token");
        reply.code(401).send({ message: "Ugyldig eller utløpt token." });
        return;
    }
}
async function requireAdmin(request, reply) {
    const user = await requireUser(request, reply);
    if (!user)
        return;
    if (!user.isAdmin) {
        reply.code(403).send({ message: "Kun admin har tilgang." });
        return;
    }
    return user;
}
app.get("/api/health", async () => ({ status: "ok" }));
app.post("/api/register", async (request, reply) => {
    const { email, password } = request.body;
    if (!email || !password) {
        return reply.code(400).send({ message: "E-post og passord må fylles ut." });
    }
    if (password.length < 8) {
        return reply.code(400).send({ message: "Passord må være minst 8 tegn." });
    }
    if (email === "admin@admin.com") {
        return reply.code(400).send({ message: "Kan ikke registrere admin-brukeren." });
    }
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
        return reply.code(409).send({ message: "E-post er allerede registrert." });
    }
    const passwordHash = await argon2.hash(password);
    const user = await prisma.user.create({
        data: { email, passwordHash },
    });
    const token = issueToken({ id: user.id, email: user.email, isAdmin: false });
    return reply.code(201).send({ id: user.id, email: user.email, token, isAdmin: false });
});
app.post("/api/login", async (request, reply) => {
    const { email, password } = request.body;
    if (!email || !password) {
        return reply.code(400).send({ message: "E-post og passord må fylles ut." });
    }
    // Hardkodet admin-konto
    if (email === "admin@admin.com" && password === "admin") {
        const token = issueToken({ id: -1, email, isAdmin: true });
        return reply.send({ id: -1, email, token, isAdmin: true });
    }
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
        return reply.code(401).send({ message: "Ugyldig e-post eller passord." });
    }
    const passwordOk = await argon2.verify(user.passwordHash, password);
    if (!passwordOk) {
        return reply.code(401).send({ message: "Ugyldig e-post eller passord." });
    }
    const token = issueToken({ id: user.id, email: user.email, isAdmin: false });
    return reply.send({ id: user.id, email: user.email, token, isAdmin: false });
});
app.get("/api/me", async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) {
        return;
    }
    const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { id: true, email: true, createdAt: true, updatedAt: true },
    });
    if (!dbUser) {
        return reply.code(404).send({ message: "Bruker ikke funnet." });
    }
    return reply.send(dbUser);
});
app.put("/api/me", async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) {
        return;
    }
    const { email, password } = request.body;
    if (!email && !password) {
        return reply.code(400).send({ message: "Oppgi minst én verdi å oppdatere." });
    }
    const data = {};
    if (email) {
        const existing = await prisma.user.findUnique({ where: { email } });
        if (existing && existing.id !== user.id) {
            return reply.code(409).send({ message: "E-post er allerede i bruk." });
        }
        data.email = email;
    }
    if (password) {
        if (password.length < 8) {
            return reply.code(400).send({ message: "Passord må være minst 8 tegn." });
        }
        data.passwordHash = await argon2.hash(password);
    }
    const updated = await prisma.user.update({
        where: { id: user.id },
        data,
        select: { id: true, email: true, updatedAt: true },
    });
    return reply.send({ id: updated.id, email: updated.email, updatedAt: updated.updatedAt });
});
app.post("/api/ideas", async (request, reply) => {
    // Optional auth: if a valid bearer token is present, we attach the user.
    // If not, we still allow ad-hoc analysis without persisting to DB.
    let user;
    const auth = request.headers.authorization;
    if (auth?.startsWith("Bearer ")) {
        const token = auth.slice("Bearer ".length);
        try {
            const decoded = jwt.verify(token, jwtSecretValue);
            if (decoded &&
                typeof decoded === "object" &&
                "id" in decoded &&
                "email" in decoded) {
                user = {
                    id: decoded.id,
                    email: decoded.email,
                };
            }
        }
        catch (err) {
            request.log.warn({ err }, "Ugyldig token i ideas-request");
            return reply.code(401).send({ message: "Ugyldig token." });
        }
    }
    const { title, content } = request.body;
    if (!title || !content) {
        return reply
            .code(400)
            .send({ message: "title og content må fylles ut." });
    }
    const analysis = simulateAiAnalysis(title, content);
    // If authenticated, persist; if not, just return analysis.
    if (user) {
        const userExists = await prisma.user.findUnique({ where: { id: user.id } });
        if (!userExists) {
            return reply.code(404).send({ message: "Fant ikke bruker." });
        }
        const idea = await prisma.idea.create({
            data: { userId: user.id, title, content, aiReply: JSON.stringify(analysis) },
        });
        return reply.code(201).send({
            id: idea.id,
            title: idea.title,
            content: idea.content,
            analysis,
        });
    }
    return reply.code(200).send({
        title,
        content,
        analysis,
        note: "Ikke lagret (ingen innlogging).",
    });
});
app.get("/api/ideas", async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) {
        return;
    }
    const ideas = await prisma.idea.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
    });
    const result = ideas.map((idea) => {
        let parsed;
        if (idea.aiReply) {
            try {
                parsed = JSON.parse(idea.aiReply);
            }
            catch (err) {
                request.log.warn({ err }, "Kunne ikke parse aiReply");
            }
        }
        return {
            id: idea.id,
            title: idea.title,
            content: idea.content,
            createdAt: idea.createdAt,
            analysis: parsed,
        };
    });
    return reply.send(result);
});
app.delete("/api/ideas/:id", async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user)
        return;
    const id = Number(request.params.id);
    if (Number.isNaN(id)) {
        return reply.code(400).send({ message: "Ugyldig id." });
    }
    const idea = await prisma.idea.findUnique({ where: { id } });
    if (!idea) {
        return reply.code(404).send({ message: "Fant ikke idéen." });
    }
    if (idea.userId !== user.id) {
        return reply.code(403).send({ message: "Du kan bare slette dine egne ideer." });
    }
    await prisma.idea.delete({ where: { id } });
    return reply.code(204).send();
});
// Admin endpoints
app.get("/api/admin/users", async (request, reply) => {
    const admin = await requireAdmin(request, reply);
    if (!admin)
        return;
    const users = await prisma.user.findMany({
        orderBy: { createdAt: "desc" },
    });
    const result = users.map((u) => ({
        id: u.id,
        email: u.email,
        createdAt: u.createdAt,
        updatedAt: u.updatedAt,
    }));
    return reply.send(result);
});
app.get("/api/admin/ideas", async (request, reply) => {
    const admin = await requireAdmin(request, reply);
    if (!admin)
        return;
    const ideas = await prisma.idea.findMany({
        orderBy: { createdAt: "desc" },
        include: {
            user: { select: { id: true, email: true } },
        },
    });
    const result = ideas.map((idea) => {
        let parsed;
        if (idea.aiReply) {
            try {
                parsed = JSON.parse(idea.aiReply);
            }
            catch (err) {
                request.log.warn({ err }, "Kunne ikke parse aiReply");
            }
        }
        return {
            id: idea.id,
            title: idea.title,
            content: idea.content,
            createdAt: idea.createdAt,
            userId: idea.userId,
            userEmail: idea.user.email,
            analysis: parsed,
        };
    });
    return reply.send(result);
});
app.delete("/api/admin/users/:id", async (request, reply) => {
    const admin = await requireAdmin(request, reply);
    if (!admin)
        return;
    const id = Number(request.params.id);
    if (Number.isNaN(id)) {
        return reply.code(400).send({ message: "Ugyldig id." });
    }
    await prisma.user.delete({ where: { id } });
    return reply.code(204).send();
});
app.delete("/api/admin/ideas/:id", async (request, reply) => {
    const admin = await requireAdmin(request, reply);
    if (!admin)
        return;
    const id = Number(request.params.id);
    if (Number.isNaN(id)) {
        return reply.code(400).send({ message: "Ugyldig id." });
    }
    await prisma.idea.delete({ where: { id } });
    return reply.code(204).send();
});
app.addHook("onClose", async () => {
    await disconnectDatabase();
});
const port = Number(process.env.PORT) || 3000;
const host = process.env.HOST || "0.0.0.0";
app
    .listen({ port, host })
    .then(() => {
    app.log.info(`Server kjører på http://${host}:${port}`);
})
    .catch(async (err) => {
    app.log.error(err, "Kunne ikke starte server");
    await disconnectDatabase();
    process.exit(1);
});
//# sourceMappingURL=server.js.map