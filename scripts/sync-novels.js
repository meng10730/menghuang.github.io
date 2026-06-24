import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONFIG_FILE = path.join(__dirname, '..', 'sync-config.json');

if (!fs.existsSync(CONFIG_FILE)) {
  console.error(`[錯誤] 找不到同步設定檔: ${CONFIG_FILE}`);
  console.error(`請先執行: node scripts/init-sync-config.js`);
  process.exit(1);
}

// 載入設定
const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));

// Check unique titles and slugs to prevent overwrite and link mismatch
const titleMap = new Map();
const slugMap = new Map();

for (const [relPath, mapInfo] of Object.entries(config.mappings)) {
  if (mapInfo.title) {
    if (titleMap.has(mapInfo.title)) {
      const prevPath = titleMap.get(mapInfo.title);
      console.error(`\n[Error] Duplicate title mapping detected: "${mapInfo.title}"`);
      console.error(`  - File 1: ${prevPath}`);
      console.error(`  - File 2: ${relPath}`);
      console.error(`To prevent duplicate backlinks, different files must have unique titles!`);
      process.exit(1);
    }
    titleMap.set(mapInfo.title, relPath);
  }
  if (mapInfo.slug) {
    // Regex validation: allow Chinese characters, alphanumeric, dash, and underscore.
    // Disallow spaces, slashes, backslashes, question marks, hashes, and other URL sensitive chars.
    const slugRegex = /^[a-z0-9-_\u4e00-\u9fa5]+$/i;
    if (!slugRegex.test(mapInfo.slug)) {
      console.error(`\n[Error] Invalid slug format detected: "${mapInfo.slug}"`);
      console.error(`  - File path: ${relPath}`);
      console.error(`  - Allowed characters: Chinese characters, alphanumeric, dash (-), underscore (_)`);
      console.error(`  - Reason: Slugs must not contain spaces, slashes, backslashes, or other URL sensitive characters.`);
      process.exit(1);
    }

    const lowerSlug = mapInfo.slug.toLowerCase();
    if (slugMap.has(lowerSlug)) {
      const prevPath = slugMap.get(lowerSlug);
      console.error(`\n[Error] Duplicate slug mapping detected: "${mapInfo.slug}"`);
      console.error(`  - File 1: ${prevPath}`);
      console.error(`  - File 2: ${relPath}`);
      console.error(`To prevent output overwrite, different files must have unique slugs!`);
      process.exit(1);
    }
    slugMap.set(lowerSlug, relPath);
  }
}

const EXTERNAL_WORKSPACE = config.workspacePath;
const SOURCE_DIR = path.join(EXTERNAL_WORKSPACE, '00_世界觀與劇本', '01_Creative_Source');
const TARGET_BASE_DIR = path.join(__dirname, '..', 'src', 'content');

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

// 將 JavaScript 物件轉換為 YAML Frontmatter 字串
function toYAML(obj) {
  let lines = ['---'];
  for (const [key, value] of Object.entries(obj)) {
    if (key === 'collection' || key === 'slug') continue; // 這些不用放入 frontmatter
    
    if (Array.isArray(value)) {
      if (value.length === 0) {
        lines.push(`${key}: []`);
      } else {
        lines.push(`${key}:`);
        value.forEach(item => {
          lines.push(`  - ${JSON.stringify(item)}`);
        });
      }
    } else if (value instanceof Date) {
      lines.push(`${key}: ${value.toISOString().split('T')[0]}`);
    } else if (typeof value === 'object' && value !== null) {
      lines.push(`${key}:`);
      for (const [subKey, subValue] of Object.entries(value)) {
        lines.push(`  ${subKey}: ${JSON.stringify(subValue)}`);
      }
    } else {
      lines.push(`${key}: ${JSON.stringify(value)}`);
    }
  }
  lines.push('---');
  return lines.join('\n');
}

function runSync() {
  console.log(`開始同步任務...`);
  console.log(`外部工作區路徑: ${EXTERNAL_WORKSPACE}`);
  console.log(`掃描原始目錄: ${SOURCE_DIR}...`);

  const externalFiles = scanMarkdownFiles(SOURCE_DIR);
  console.log(`本機工作區掃描到 ${externalFiles.length} 個 Markdown 檔案。`);

  // 1. 嚴格檢查：確認是否有檔案未登記在對照表中
  const missingFiles = [];
  externalFiles.forEach(file => {
    if (!config.mappings[file]) {
      missingFiles.push(file);
    }
  });

  if (missingFiles.length > 0) {
    console.error(`\n❌ [同步中斷] 偵測到有 ${missingFiles.length} 個檔案未登記在 sync-config.json 中：`);
    missingFiles.forEach(file => {
      console.error(`   - ${file}`);
    });
    
    console.error(`\n💡 請在 sync-config.json 的 "mappings" 中加上對應設定，例如：`);
    console.error(JSON.stringify(
      {
        [missingFiles[0]]: {
          collection: "worldview",
          slug: path.basename(missingFiles[0], '.md').replace(/^\d+_/g, ''),
          title: path.basename(missingFiles[0], '.md').replace(/^\d+_/g, ''),
          category: "世界觀",
          pubDate: new Date().toISOString().split('T')[0]
        }
      },
      null,
      2
    ));
    process.exit(1);
  }

  console.log(`✓ 檔案登記檢查通過！`);

  // 2. 建立標題/檔名對應表，用以解析雙向連結
  const titleToConfig = {};
  const slugToConfig = {};
  const fileToConfig = {};

  for (const [relPath, mapInfo] of Object.entries(config.mappings)) {
    const baseNameNoExt = path.basename(relPath, '.md');
    
    fileToConfig[baseNameNoExt] = mapInfo;
    if (mapInfo.title) titleToConfig[mapInfo.title] = mapInfo;
    if (mapInfo.slug) slugToConfig[mapInfo.slug] = mapInfo;
  }

  // 3. 處理與複製檔案
  let syncCount = 0;
  externalFiles.forEach(file => {
    const mapInfo = config.mappings[file];
    const fullSourcePath = path.join(SOURCE_DIR, file);
    let content = fs.readFileSync(fullSourcePath, 'utf8');

    // 3a. 解析雙向連結 [[檔案名稱|別名]] 或 [[檔案名稱#錨點|別名]]
    // Regex 說明：\[\[([^\]|#]*)(#[^\]|]*)?(\|[^\]]*)?\]\]
    // baseTerm: 連結主體
    // anchor: 錨點 (含 #, 選填)
    // aliasPart: 別名 (含 |, 選填)
    content = content.replace(/\[\[([^\]|#]+)(#[^\]|]+)?(?:\|([^\]]+))?\]\]/g, (match, baseTerm, anchor, aliasPart) => {
      const cleanBaseTerm = baseTerm.replace(/\.md$/i, '').trim();
      const cleanAnchor = anchor ? anchor.trim() : '';
      const cleanAlias = aliasPart ? aliasPart.replace(/^\|/, '').trim() : '';

      let targetMapping = fileToConfig[cleanBaseTerm] || titleToConfig[cleanBaseTerm] || slugToConfig[cleanBaseTerm];

      if (targetMapping) {
        // 組成跳轉路徑：/shanzhuang/[collection]/[slug][anchor]
        const displayTitle = cleanAlias || targetMapping.title || cleanBaseTerm;
        const linkPath = `/shanzhuang/${targetMapping.collection}/${targetMapping.slug}${cleanAnchor}`;
        return `[${displayTitle}](${linkPath})`;
      } else {
        // 找不到對照，優先降級為別名；無別名則降級為主體名稱，並印出警告，且改為帶有 broken-link 樣式的 HTML
        const fallbackText = cleanAlias || cleanBaseTerm;
        console.warn(`⚠️  [警告] 檔案 "${file}" 中的連結 "${match}" 無法在對照表中解析，已降級為失效標籤 "${fallbackText}"。`);
        return `<span class="broken-link" title="此條目暫無詳細設定">${fallbackText}</span>`;
      }
    });

    // 3b. 注入 Frontmatter
    // 設定預設 pubDate
    if (!mapInfo.pubDate) {
      const stat = fs.statSync(fullSourcePath);
      mapInfo.pubDate = stat.mtime.toISOString().split('T')[0];
    }
    
    const frontmatter = toYAML(mapInfo);
    
    // 3c. 組合唯讀提示語與檔案內容
    const finalFileContent = `<!-- 此檔案由同步腳本自動產生，請勿在此直接修改 -->\n${frontmatter}\n\n${content}`;

    // 3d. 寫入專案目標目錄
    const targetDir = path.join(TARGET_BASE_DIR, mapInfo.collection);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    
    const targetFilePath = path.join(targetDir, `${mapInfo.slug}.md`);
    fs.writeFileSync(targetFilePath, finalFileContent, 'utf8');
    syncCount++;
  });

  console.log(`\n🎉 [成功] 同步完成！共計同步 ${syncCount} 個設定與連載檔案。`);
}

runSync();
