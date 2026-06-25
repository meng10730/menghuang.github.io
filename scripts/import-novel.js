import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONFIG_FILE = path.join(__dirname, '..', 'sync-config.json');

if (!fs.existsSync(CONFIG_FILE)) {
  console.error(`[錯誤] 找不到同步設定檔: ${CONFIG_FILE}`);
  process.exit(1);
}

const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
const EXTERNAL_WORKSPACE = config.workspacePath;
const SOURCE_DIR = path.join(EXTERNAL_WORKSPACE, '00_世界觀與劇本', '01_Creative_Source');

// 內建忽略清單 (預設忽略系統與暫存檔)
const IGNORE_PATTERNS = [
  /^\..*/,            // 隱藏檔案或資料夾 (如 .git, .obsidian)
  /^~.*/,             // 暫存檔 (如 ~WordTemp)
  /desktop\.ini/i,
  /thumbs\.db/i
];

function shouldIgnore(fileName) {
  return IGNORE_PATTERNS.some(pattern => pattern.test(fileName));
}

// 遞迴取得外部工作區所有 Markdown 檔案的相對路徑
function scanMarkdownFiles(dir, baseDir = dir) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    if (shouldIgnore(file)) return;
    
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(scanMarkdownFiles(fullPath, baseDir));
    } else if (file.endsWith('.md')) {
      const relativePath = path.relative(baseDir, fullPath).replace(/\\/g, '/');
      results.push(relativePath);
    }
  });
  return results;
}

const externalFiles = scanMarkdownFiles(SOURCE_DIR);

// 篩選出未登記在 mappings 中的檔案
const unregisteredFiles = externalFiles.filter(file => !config.mappings[file]);

if (unregisteredFiles.length === 0) {
  console.log('沒有發現未登記的 Markdown 檔案。一切同步正常，將優雅退出。');
  process.exit(0);
}

// 建立現有 title 與 slug 對照表以供防重檢查
const titleMap = new Map();
const slugMap = new Map();

for (const [relPath, mapInfo] of Object.entries(config.mappings)) {
  if (mapInfo.title) {
    titleMap.set(mapInfo.title, relPath);
  }
  if (mapInfo.slug) {
    slugMap.set(mapInfo.slug.toLowerCase(), relPath);
  }
}

console.log('\n發現以下未登記的小說/設定檔：');
unregisteredFiles.forEach((file, index) => {
  console.log(`[${index + 1}] ${file}`);
});

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

async function main() {
  let selectedFileIndex = -1;
  while (true) {
    const ans = await question(`\n請輸入檔案的序號來選擇 (1-${unregisteredFiles.length}): `);
    const idx = parseInt(ans.trim(), 10) - 1;
    if (idx >= 0 && idx < unregisteredFiles.length) {
      selectedFileIndex = idx;
      break;
    }
    console.log('序號無效，請重新輸入。');
  }

  const selectedFile = unregisteredFiles[selectedFileIndex];
  console.log(`\n您選擇的檔案為: ${selectedFile}`);

  // 計算預設 Title
  const baseName = path.basename(selectedFile, '.md');
  const defaultTitle = baseName.replace(/^\d+_/g, '');

  let title = '';
  while (true) {
    const titleAns = await question(`文章標題 (Title) [預設: "${defaultTitle}"]: `);
    const inputTitle = titleAns.trim() || defaultTitle;
    if (!inputTitle) {
      console.log('文章標題不能為空！');
      continue;
    }
    if (titleMap.has(inputTitle)) {
      console.log(`\n❌ [錯誤] 標題 "${inputTitle}" 已被以下檔案佔用：`);
      console.log(`  - 檔案路徑: ${titleMap.get(inputTitle)}`);
      console.log(`請使用其他標題！\n`);
      continue;
    }
    title = inputTitle;
    break;
  }

  // 計算預設 Slug，必須嚴格過濾
  const sanitizeSlug = (str) => {
    // 只允許中英數、減號 (-) 與底線 (_)
    return str.replace(/[^a-zA-Z0-9-_\u4e00-\u9fa5]/g, '');
  };
  const defaultSlug = sanitizeSlug(defaultTitle);
  let slug = '';
  while (true) {
    const slugAns = await question(`網址別名 (Slug) [預設: "${defaultSlug}"]: `);
    const inputSlug = slugAns.trim() || defaultSlug;
    const sanitized = sanitizeSlug(inputSlug);
    if (!sanitized) {
      console.log('網址別名淨化後不可為空！請輸入包含中英數、減號 (-) 或底線 (_) 的別名。');
      continue;
    }
    if (sanitized !== inputSlug) {
      console.log(`警告: 別名已被自動淨化。原始: "${inputSlug}" -> 淨化後: "${sanitized}"`);
    }
    const lowerSlug = sanitized.toLowerCase();
    if (slugMap.has(lowerSlug)) {
      console.log(`\n❌ [錯誤] 別名 "${sanitized}" 已被以下檔案佔用：`);
      console.log(`  - 檔案路徑: ${slugMap.get(lowerSlug)}`);
      console.log(`請使用其他別名！\n`);
      continue;
    }
    slug = sanitized;
    break;
  }

  // 選擇所屬分類
  const categories = ['novels', 'worldview', 'characters', 'factions', 'guoxue'];
  console.log('\n請選擇所屬分類 (Category/Collection):');
  categories.forEach((cat, index) => {
    console.log(`[${index + 1}] ${cat}`);
  });
  let collection = '';
  while (true) {
    const catAns = await question(`請輸入分類的序號 (1-${categories.length}) [預設: 1]: `);
    const cIdx = catAns.trim() === '' ? 0 : parseInt(catAns.trim(), 10) - 1;
    if (cIdx >= 0 && cIdx < categories.length) {
      collection = categories[cIdx];
      break;
    }
    console.log('序號無效，請重新輸入。');
  }

  // 根據 collection 給定預設值
  const pubDate = new Date().toISOString().split('T')[0];
  let mappingData = {
    collection,
    slug,
    title,
    pubDate
  };

  if (collection === 'novels') {
    mappingData.description = `${title} - 大綱與劇本連載`;
    mappingData.genre = ['仙俠', '架空'];
    mappingData.status = 'ongoing';
  } else if (collection === 'worldview') {
    mappingData.category = '世界觀';
  } else if (collection === 'factions') {
    mappingData.category = '勢力';
  } else if (collection === 'characters') {
    mappingData.name = title;
    mappingData.alias = [title];
    mappingData.affiliation = '';
    mappingData.novel = '長生劫';
    mappingData.tags = [];
  } else if (collection === 'guoxue') {
    mappingData.source = '未知';
    mappingData.category = 'other';
    mappingData.tags = [];
  }

  console.log('\n即將寫入的映射配置：');
  console.log(JSON.stringify({ [selectedFile]: mappingData }, null, 2));

  const confirmAns = await question(`\n確認寫入？ (y/n) [預設: y]: `);
  if (confirmAns.trim().toLowerCase() === 'n') {
    console.log('操作已取消。');
    rl.close();
    process.exit(0);
  }

  // 寫入 json
  config.mappings[selectedFile] = mappingData;
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8');
  console.log(`\n✓ sync-config.json 更新成功！`);

  rl.close();

  // 自動執行同步腳本
  console.log('\n開始執行首次單向同步...');
  try {
    execSync('node scripts/sync-novels.js', { stdio: 'inherit' });
    console.log('\n🎉 同步完成！');
  } catch (err) {
    console.error(`\n❌ 同步執行失敗: ${err.message}`);
  }
}

main().catch(err => {
  console.error(err);
  if (rl) rl.close();
  process.exit(1);
});
