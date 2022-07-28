import * as dump from './dump';
import * as initTest from './init';
import * as seed from './seed';
import * as migrate from './migrate';
import * as transformPrismaSchema from './transform-prisma-schema';
export const commands: any = [dump, initTest, seed, migrate, transformPrismaSchema];
