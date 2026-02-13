/**
 * Setup file for E2E tests
 * Configures test environment before running tests
 */
import * as dotenv from 'dotenv';
import * as path from 'node:path';

// Set test environment
process.env.NODE_ENV = 'test';

// Cargar variables de entorno — prioriza .env.test, luego .env
dotenv.config({ path: path.resolve(process.cwd(), '.env.test') });
//dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// Increase timeout for async operations
jest.setTimeout(30000);

// Global beforeAll hook
beforeAll(async () => {
  console.log('🧪 E2E Test Suite Starting...');
});

// Global afterAll hook
afterAll(async () => {
  console.log('🧪 E2E Test Suite Complete');
});

// Handle unhandled rejections
process.on('unhandledRejection', (error) => {
  console.error('Unhandled rejection in tests:', error);
});