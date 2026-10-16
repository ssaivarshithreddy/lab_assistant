import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Priority 1: Project root .env (master configuration for whole monorepo)
// Priority 2: backend/.env (fallback if running in isolated container)
const rootEnvPath = path.resolve(__dirname, '../.env');
const localEnvPath = path.resolve(__dirname, './.env');

if (fs.existsSync(rootEnvPath)) {
  dotenv.config({ path: rootEnvPath, quiet: true });
} else if (fs.existsSync(localEnvPath)) {
  dotenv.config({ path: localEnvPath, quiet: true });
} else {
  dotenv.config({ quiet: true });
}
