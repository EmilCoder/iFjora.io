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
app.get("/api/health", async () => ({ status: "ok" }));
app.post("/api/register", async (request, reply) => {
    const { email, password } = request.body;
    if (!email || !password) {
        return reply.code(400).send({ message: "E-post og passord må fylles ut." });
    }
    if (password.length < 8) {
        return reply.code(400).send({ message: "Passord må være minst 8 tegn." });
    }
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
        return reply.code(409).send({ message: "E-post er allerede registrert." });
    }
    const passwordHash = await argon2.hash(password);
    const user = await prisma.user.create({
        data: { email, passwordHash },
    });
    const token = issueToken({ id: user.id, email: user.email });
    return reply.code(201).send({ id: user.id, email: user.email, token });
});
app.post("/api/login", async (request, reply) => {
    const { email, password } = request.body;
    if (!email || !password) {
        return reply.code(400).send({ message: "E-post og passord må fylles ut." });
    }
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
        return reply.code(401).send({ message: "Ugyldig e-post eller passord." });
    }
    const passwordOk = await argon2.verify(user.passwordHash, password);
    if (!passwordOk) {
        return reply.code(401).send({ message: "Ugyldig e-post eller passord." });
    }
    const token = issueToken({ id: user.id, email: user.email });
    return reply.send({ id: user.id, email: user.email, token });
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
    const user = await requireUser(request, reply);
    if (!user) {
        return;
    }
    const { title, content } = request.body;
    if (!title || !content) {
        return reply
            .code(400)
            .send({ message: "title og content må fylles ut." });
    }
    const userExists = await prisma.user.findUnique({ where: { id: user.id } });
    if (!userExists) {
        return reply.code(404).send({ message: "Fant ikke bruker." });
    }
    const idea = await prisma.idea.create({
        data: { userId: user.id, title, content },
    });
    return reply.code(201).send({
        id: idea.id,
        title: idea.title,
        content: idea.content,
        aiReply: idea.aiReply,
    });
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