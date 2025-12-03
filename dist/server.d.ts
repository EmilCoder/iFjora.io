type JwtPayload = {
    id: number;
    email: string;
};
declare module "fastify" {
    interface FastifyRequest {
        user?: JwtPayload;
    }
}
export {};
//# sourceMappingURL=server.d.ts.map