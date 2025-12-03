import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
export declare const prisma: PrismaClient<{
    adapter: PrismaMariaDb;
}, never, import("@prisma/client/runtime/library").DefaultArgs>;
export declare function disconnectDatabase(): Promise<void>;
//# sourceMappingURL=db.d.ts.map