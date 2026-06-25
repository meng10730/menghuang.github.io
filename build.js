import { build } from 'astro';
import fs from 'fs-extra';
import path from 'path';

process.on('uncaughtException', (err) => {
  console.error('--- BUILD SYSTEM UNCAUGHT EXCEPTION ---');
  console.error(err);
});
process.on('unhandledRejection', (reason) => {
  console.error('--- BUILD SYSTEM UNHANDLED REJECTION ---');
  console.error(reason);
});

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
    console.log('--- Running Astro Build (Programmatic) ---');
    // 強制注入 build 參數，確保 config 判定為生產建置
    if (!process.argv.includes('build')) {
      process.argv.push('build');
    }
    await build({});
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
    console.error('Build failed with error:');
    console.error(buildError);
    process.exit(1);
  } else {
    console.log('Build completed successfully!');
  }
}
run();
