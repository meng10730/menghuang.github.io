import { execSync } from 'child_process';
import fs from 'fs-extra';
import path from 'path';

const pathPage = path.resolve('src/pages/keystatic');
const pathPageTemp = path.resolve('temp-keystatic-page');
const pathApi = path.resolve('src/pages/api/keystatic');
const pathApiTemp = path.resolve('temp-keystatic-api');

async function run() {
  console.log('--- Preparing build (disabling dev-only routes) ---');
  if (await fs.pathExists(pathPage)) {
    await fs.move(pathPage, pathPageTemp, { overwrite: true });
    console.log('Disabled keystatic page folder');
  }
  if (await fs.pathExists(pathApi)) {
    await fs.move(pathApi, pathApiTemp, { overwrite: true });
    console.log('Disabled keystatic API folder');
  }

  let buildError = null;
  try {
    console.log('--- Running Astro Build ---');
    const args = process.argv.slice(2).join(' ');
    execSync(`npx astro build ${args}`, { stdio: 'inherit' });
  } catch (err) {
    buildError = err;
  } finally {
    console.log('--- Cleaning up (restoring dev-only routes) ---');
    if (await fs.pathExists(pathPageTemp)) {
      await fs.move(pathPageTemp, pathPage, { overwrite: true });
      console.log('Restored keystatic page folder');
    }
    if (await fs.pathExists(pathApiTemp)) {
      await fs.move(pathApiTemp, pathApi, { overwrite: true });
      console.log('Restored keystatic API folder');
    }
  }

  if (buildError) {
    console.error('Build failed!');
    process.exit(1);
  } else {
    console.log('Build completed successfully!');
  }
}
run();
