import path from 'path';
import { defineConfig } from 'prisma/config';
import { config as loadEnv } from 'dotenv';

loadEnv({ path: path.resolve(__dirname, '.env') });

export default defineConfig({
  schema: 'libs/prisma/schema.prisma',
});
