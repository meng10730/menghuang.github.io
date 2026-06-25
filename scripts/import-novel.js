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

// 輔劇函數：簡易 YAML 解析器，用於提取 Markdown 中已存在的 YAML 屬性
function parseYAML(yamlStr) {
  const result = {};
  if (!yamlStr) return result;
  
  const lines = yamlStr.split(/\r?\n/);
  let currentKey = null;
  let currentArray = null;

  for (let line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    // 處理陣列元素: - value
    if (trimmed.startsWith('-') && currentKey && currentArray) {
      let val = trimmed.substring(1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.substring(1, val.length - 1);
      }
      currentArray.push(val);
      continue;
    }

    // 處理鍵值對: key: value
    const colonIdx = line.indexOf(':');
    if (colonIdx !== -1) {
      const key = line.substring(0, colonIdx).trim();
      let value = line.substring(colonIdx + 1).trim();

      if (value === '') {
        currentKey = key;
        currentArray = [];
        result[key] = currentArray;
      } else {
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
          value = value.substring(1, value.length - 1);
        }
        
        if (value.startsWith('[') && value.endsWith(']')) {
          const content = value.substring(1, value.length - 1);
          result[key] = content.split(',').map(item => {
            let s = item.trim();
            if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
              s = s.substring(1, s.length - 1);
            }
            return s;
          }).filter(Boolean);
        } else {
          result[key] = value;
        }
        currentKey = null;
        currentArray = null;
      }
    }
  }
  return result;
}

// 輔助函數：讀取 Markdown 檔案的 Frontmatter
function readFrontmatter(filePath) {
  if (!fs.existsSync(filePath)) return {};
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const match = content.match(/^---([\s\S]*?)---/);
    if (match) {
      return parseYAML(match[1]);
    }
  } catch (err) {
    console.warn(`[警告] 讀取外部檔案 Frontmatter 失敗: ${err.message}`);
  }
  return {};
}

// 輔助函數：解析多值輸入
function parseMultiValue(input, defaultVal) {
  const str = input.trim();
  if (!str) return defaultVal;
  return str.split(/[,，、\s]+/).map(t => t.trim()).filter(Boolean);
}

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

  // 讀取該檔案可能已有的 frontmatter，做合併基礎
  const externalFilePath = path.join(SOURCE_DIR, selectedFile);
  const existingFrontmatter = readFrontmatter(externalFilePath);

  // 計算預設 Title
  const baseName = path.basename(selectedFile, '.md');
  const defaultTitle = existingFrontmatter.title || existingFrontmatter.name || baseName.replace(/^\d+_/g, '');

  // 計算預設 Slug，必須嚴格過濾
  const sanitizeSlug = (str) => {
    return str.replace(/[^a-zA-Z0-9-_\u4e00-\u9fa5]/g, '');
  };
  const defaultSlug = sanitizeSlug(existingFrontmatter.slug || defaultTitle);

  const categories = ['novels', 'worldview', 'characters', 'factions', 'guoxue'];
  const defaultCategory = existingFrontmatter.collection || 'novels';

  // 問答資料物件
  let data = {};
  let dynamicSteps = [];

  function initializeDynamicSteps(col, currentTitle) {
    dynamicSteps = [];
    if (col === 'novels') {
      dynamicSteps.push({
        key: 'description',
        prompt: () => `小說簡介 (description) [預設: "${existingFrontmatter.description || currentTitle + ' - 大綱與劇本連載'}"]: `,
        handle: (input, d) => {
          d.description = input.trim() || existingFrontmatter.description || `${currentTitle} - 大綱與劇本連載`;
        }
      });
      dynamicSteps.push({
        key: 'genre',
        prompt: () => `類型標籤 (genre) (多個請用逗號、頓號或空格隔開) [預設: "${(existingFrontmatter.genre || ['仙俠', '架空']).join(', ')}"]: `,
        handle: (input, d) => {
          d.genre = parseMultiValue(input, existingFrontmatter.genre || ['仙俠', '架空']);
        }
      });
      dynamicSteps.push({
        key: 'status',
        prompt: () => {
          console.log('\n請選擇連載狀態 (status)：\n[1] 連載中 (ongoing)\n[2] 已完結 (completed)\n[3] 停更 (hiatus)');
          const defIdx = ['ongoing', 'completed', 'hiatus'].indexOf(existingFrontmatter.status || 'ongoing') + 1;
          return `請輸入狀態序號 (1-3) [預設: ${defIdx}]: `;
        },
        handle: (input, d) => {
          const idxVal = input.trim();
          const opts = ['ongoing', 'completed', 'hiatus'];
          const defIdx = opts.indexOf(existingFrontmatter.status || 'ongoing') + 1;
          const idx = idxVal === '' ? defIdx : parseInt(idxVal, 10);
          d.status = (idx >= 1 && idx <= 3) ? opts[idx - 1] : (existingFrontmatter.status || 'ongoing');
        }
      });
    } else if (col === 'characters') {
      dynamicSteps.push({
        key: 'name',
        prompt: () => `人物名稱 (name) [預設: "${existingFrontmatter.name || currentTitle}"]: `,
        handle: (input, d) => {
          d.name = input.trim() || existingFrontmatter.name || currentTitle;
        }
      });
      dynamicSteps.push({
        key: 'description',
        prompt: () => `人物簡介 (description，用於懸浮氣泡) [預設: "${existingFrontmatter.description || '暫無介紹'}"]: `,
        handle: (input, d) => {
          d.description = input.trim() || existingFrontmatter.description || '暫無介紹';
        }
      });
      dynamicSteps.push({
        key: 'alias',
        prompt: () => `人物別名/江湖稱號 (alias) (多個請用逗號隔開) [預設: "${(existingFrontmatter.alias || [currentTitle]).join(', ')}"]: `,
        handle: (input, d) => {
          d.alias = parseMultiValue(input, existingFrontmatter.alias || [currentTitle]);
        }
      });
      dynamicSteps.push({
        key: 'affiliation',
        prompt: () => `所屬門派或陣營 (affiliation) [預設: "${existingFrontmatter.affiliation || '無'}"]: `,
        handle: (input, d) => {
          d.affiliation = input.trim() || existingFrontmatter.affiliation || '無';
        }
      });
      dynamicSteps.push({
        key: 'novel',
        prompt: () => `所屬小說名稱 (novel) [預設: "${existingFrontmatter.novel || '長生劫'}"]: `,
        handle: (input, d) => {
          d.novel = input.trim() || existingFrontmatter.novel || '長生劫';
        }
      });
      dynamicSteps.push({
        key: 'tags',
        prompt: () => `人物標籤 (tags) (如：主角, 反派，用逗號隔開) [預設: "${(existingFrontmatter.tags || []).join(', ')}"]: `,
        handle: (input, d) => {
          d.tags = parseMultiValue(input, existingFrontmatter.tags || []);
        }
      });
    } else if (col === 'worldview') {
      dynamicSteps.push({
        key: 'description',
        prompt: () => `設定簡介 (description，用於懸浮氣泡) [預設: "${existingFrontmatter.description || '暫無設定介紹'}"]: `,
        handle: (input, d) => {
          d.description = input.trim() || existingFrontmatter.description || '暫無設定介紹';
        }
      });
      dynamicSteps.push({
        key: 'category',
        prompt: () => `設定分類 (category) (例如：機制、地理、神明體系) [預設: "${existingFrontmatter.category || '世界觀'}"]: `,
        handle: (input, d) => {
          d.category = input.trim() || existingFrontmatter.category || '世界觀';
        }
      });
    } else if (col === 'factions') {
      dynamicSteps.push({
        key: 'description',
        prompt: () => `勢力簡介 (description，用於懸浮氣泡) [預設: "${existingFrontmatter.description || '暫無勢力介紹'}"]: `,
        handle: (input, d) => {
          d.description = input.trim() || existingFrontmatter.description || '暫無勢力介紹';
        }
      });
      dynamicSteps.push({
        key: 'category',
        prompt: () => `勢力分類 (category) (例如：正派、地下、世俗、中立) [預設: "${existingFrontmatter.category || '勢力'}"]: `,
        handle: (input, d) => {
          d.category = input.trim() || existingFrontmatter.category || '勢力';
        }
      });
    } else if (col === 'guoxue') {
      dynamicSteps.push({
        key: 'source',
        prompt: () => `文獻出處 (source) (例如：論語、道德經) [預設: "${existingFrontmatter.source || '未知'}"]: `,
        handle: (input, d) => {
          d.source = input.trim() || existingFrontmatter.source || '未知';
        }
      });
      dynamicSteps.push({
        key: 'category',
        prompt: () => {
          console.log('\n請選擇國學分類 (category)：\n[1] 儒家 (confucianism)\n[2] 道家 (taoism)\n[3] 佛家 (buddhism)\n[4] 史學 (history)\n[5] 詩詞 (poetry)\n[6] 其他 (other)');
          const opts = ['confucianism', 'taoism', 'buddhism', 'history', 'poetry', 'other'];
          const defIdx = opts.indexOf(existingFrontmatter.category || 'other') + 1;
          return `請輸入分類序號 (1-6) [預設: ${defIdx}]: `;
        },
        handle: (input, d) => {
          const idxVal = input.trim();
          const opts = ['confucianism', 'taoism', 'buddhism', 'history', 'poetry', 'other'];
          const defIdx = opts.indexOf(existingFrontmatter.category || 'other') + 1;
          const idx = idxVal === '' ? defIdx : parseInt(idxVal, 10);
          d.category = (idx >= 1 && idx <= 6) ? opts[idx - 1] : (existingFrontmatter.category || 'other');
        }
      });
      dynamicSteps.push({
        key: 'tags',
        prompt: () => `筆記標籤 (tags) (用逗號隔開) [預設: "${(existingFrontmatter.tags || []).join(', ')}"]: `,
        handle: (input, d) => {
          d.tags = parseMultiValue(input, existingFrontmatter.tags || []);
        }
      });
    }
  }

  const steps = [
    {
      key: 'title',
      prompt: () => `文章標題 (Title) [預設: "${defaultTitle}"]: `,
      handle: (input, d) => {
        const val = input.trim() || defaultTitle;
        if (!val) throw new Error('文章標題不能為空！');
        if (titleMap.has(val) && titleMap.get(val) !== selectedFile) {
          throw new Error(`標題 "${val}" 已被 "${titleMap.get(val)}" 佔用！`);
        }
        d.title = val;
      }
    },
    {
      key: 'slug',
      prompt: () => `網址別名 (Slug) [預設: "${defaultSlug}"]: `,
      handle: (input, d) => {
        const val = input.trim() || defaultSlug;
        const sanitized = sanitizeSlug(val);
        if (!sanitized) throw new Error('網址別名淨化後不可為空！');
        const lower = sanitized.toLowerCase();
        if (slugMap.has(lower) && slugMap.get(lower) !== selectedFile) {
          throw new Error(`別名 "${sanitized}" 已被 "${slugMap.get(lower)}" 佔用！`);
        }
        d.slug = sanitized;
      }
    },
    {
      key: 'collection',
      prompt: () => {
        console.log('\n請選擇所屬分類 (Category/Collection):');
        categories.forEach((cat, idx) => {
          const isDef = cat === defaultCategory ? ' (預設)' : '';
          console.log(`[${idx + 1}] ${cat}${isDef}`);
        });
        const defIdx = categories.indexOf(defaultCategory) + 1;
        return `請輸入分類的序號 (1-${categories.length}) [預設: ${defIdx}]: `;
      },
      handle: (input, d) => {
        const idxStr = input.trim();
        const defIdx = categories.indexOf(defaultCategory) + 1;
        const cIdx = idxStr === '' ? defIdx - 1 : parseInt(idxStr, 10) - 1;
        if (cIdx >= 0 && cIdx < categories.length) {
          d.collection = categories[cIdx];
          initializeDynamicSteps(d.collection, d.title);
        } else {
          throw new Error('序號無效。');
        }
      }
    }
  ];

  console.log('\n💡 提示：在輸入任何欄位時，輸入「..」可退回上一個欄位重新填寫。');

  let currentStepIdx = 0;
  while (currentStepIdx < steps.length + dynamicSteps.length) {
    const isFixedStep = currentStepIdx < steps.length;
    const step = isFixedStep ? steps[currentStepIdx] : dynamicSteps[currentStepIdx - steps.length];
    
    const ans = await question(step.prompt());

    if (ans.trim() === '..') {
      if (currentStepIdx > 0) {
        // 回退
        const prevStep = currentStepIdx - 1 < steps.length 
          ? steps[currentStepIdx - 1] 
          : dynamicSteps[currentStepIdx - 1 - steps.length];
        delete data[prevStep.key];
        
        if (currentStepIdx === steps.length) {
          dynamicSteps = [];
        }
        currentStepIdx--;
        console.log(`[回退] 已回到上一欄位。`);
      } else {
        console.log(`[警告] 已經是第一個欄位，無法再回退。`);
      }
      continue;
    }

    try {
      step.handle(ans, data);
      currentStepIdx++;
    } catch (err) {
      console.log(`❌ [輸入錯誤] ${err.message}`);
    }
  }

  // 組合與合併外部已有的 frontmatter，手動輸入的 data 會覆寫同名欄位
  const pubDate = new Date().toISOString().split('T')[0];
  const mappingData = {
    ...existingFrontmatter,
    ...data,
    pubDate: data.pubDate || existingFrontmatter.pubDate || pubDate
  };

  // 確保核心定位欄位正確無誤
  mappingData.collection = data.collection;
  mappingData.slug = data.slug;
  mappingData.title = data.title;

  console.log('\n即將寫入的映射配置 (已合併外部 Frontmatter)：');
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
