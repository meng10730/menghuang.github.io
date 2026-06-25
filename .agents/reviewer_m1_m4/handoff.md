# Handoff Report — 2026-06-25T09:12:00+08:00

## 1. Observation (觀察事實)
本代理人對實作工程師就需求 R1-R4 的修改進行了靜態代碼走查與全站建置驗證，具體觀察事實如下：

### 1.1 Keystatic 配置
- 檔案路徑：`keystatic.config.ts`
- 觀察內容（第 3-7 行）：
  ```typescript
  export default config({
    storage: {
      kind: 'github',
      repo: 'meng10730/meng10730.github.io',
    },
  ```
  - 儲存庫儲存模式配置為 `'github'`。
  - 指向目標儲存庫為 `'meng10730/meng10730.github.io'`。

### 1.2 未登記文章處理與防禦性跳過
- 檔案路徑：`scripts/sync-novels.js`
- 觀察內容（第 206-210 行，警告機制）：
  ```javascript
  if (missingFiles.length > 0) {
    console.warn(`\x1b[33m⚠️  [警告] 偵測到有 ${missingFiles.length} 篇新文章可執行一鍵匯入 (一鍵匯入.bat)：\x1b[0m`);
    missingFiles.forEach(file => {
      console.warn(`\x1b[33m   - ${file}\x1b[0m`);
    });
  }
  ```
  - 未登記檔案處理成功修改為黃色控制台警告（`\x1b[33m`），且去除了阻斷執行的 `process.exit(1)`。
- 觀察內容（第 238-240 行，防禦性跳過）：
  ```javascript
  externalFiles.forEach(file => {
    const mapInfo = config.mappings[file];
    if (!mapInfo) return; // 跳過未登記的檔案，不執行同步
  ```
  - 在同步迴圈開頭加入了 `if (!mapInfo) return;` 防禦性跳過，避免在後續 `mapInfo.collection` 等操作處拋出 `TypeError: Cannot read properties of undefined (reading 'collection')` 異常而崩潰。

### 1.3 一鍵匯入與首次同步必填欄位補全
- 檔案路徑：`scripts/import-novel.js` 與 `一鍵匯入.bat`
- 觀察內容（互動選單）：
  ```javascript
  console.log('\n發現以下未登記的小說/設定檔：');
  unregisteredFiles.forEach((file, index) => {
    console.log(`[${index + 1}] ${file}`);
  });
  ```
  - 互動選單明確展示了 1-indexed 序號，並正確接受輸入進行選擇。
- 觀察內容（Slug 消毒與重複性檢驗）：
  ```javascript
  const sanitizeSlug = (str) => {
    return str.replace(/[^a-zA-Z0-9-_\u4e00-\u9fa5]/g, '');
  };
  ```
  - Slug 重複性與 Title 重複性皆使用了 `titleMap` 與 `slugMap`（轉小寫）進行了嚴格防重，且對淨化後的 `slug` 進行了非空檢驗（防範全部特殊字元被淨化為空的情況）。
- 觀察內容（首次同步補全必填欄位）：
  - 對 `novels`、`characters`、`worldview`、`factions`、`guoxue` 各種 collection 的特定必填欄位（例如 `novels` 的 `description`、`genre`、`status`，以及全局必填的 `pubDate`）都提供了符合 Astro schema 規範的預設值。
- 觀察內容（寫入設定）：
  - 使用 `fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8')` 格式化寫入，格式正確。

### 1.4 Git Rebase 衝突處理與回滾
- 檔案路徑：`開啟編輯器.bat` 與 `一鍵同步.bat`
- 觀察內容（Git Rebase 回滾與中斷）：
  ```bat
  git pull --rebase
  if %errorlevel% neq 0 (
      echo.
      echo ❌ [Git 衝突] 偵測到與線上代碼衝突！
      echo 正在還原本地狀態 (git rebase --abort)...
      git rebase --abort
      echo.
      echo 💡 請手動解決 Git 衝突後，再重新執行此腳本。
      echo.
      pause
      exit /b 1
  )
  ```
  - 兩份批次檔皆正確捕獲了 `git pull --rebase` 的異常 Exit Code，並使用 `git rebase --abort` 還原了本地狀態，最後執行 `exit /b 1` 徹底中斷批次運行，防止後續同步代碼在衝突狀態下強行執行。

### 1.5 全站建置驗證
- 執行指令：`npm run build`
- 執行結果：
  ```
  09:05:06 [build] 83 page(s) built in 3.34s
  09:05:06 [build] Complete!
  --- Cleaning up (restoring dev-only routes) ---
  Restored keystatic page folder
  Restored keystatic API folder
  Build completed successfully!
  ```
  - 全站 83 個網頁皆成功完成建置，無任何 Astro/TypeScript/Zod 錯誤，Exit Code 為 0。

---

## 2. Logic Chain (推理邏輯鏈)
1. **儲存配置正確性**：`keystatic.config.ts` 中的 `storage.kind` 與 `storage.repo` 配置字串與目標完全相符，因此 Keystatic 雲端儲存指向正確。
2. **同步腳本健壯性**：由於在 `sync-novels.js` 中對未登記檔案實施了 `if (!mapInfo) return;` 阻斷跳過，且將原先的 `process.exit(1)` 降級為控制台黃色警告，所以即使存在新文章，同步腳本也能在輸出警告後安全且流暢地完成其餘已登記文章的同步，而不會引發程式碼崩潰。
3. **一鍵匯入系統之安全與完整性**：
   - 互動選單序號及防重檢驗能夠防止檔名與網址別名覆寫。
   - Slug 消毒規則與同步腳本中的正則驗證相符，防止了非法字元寫入 mappings。
   - 首次同步時補全了 `pubDate` 與各 collection 專屬的必填欄位，使得 Astro 在讀取新檔案的 frontmatter 時不會因為 schema 驗證失敗而阻斷建置。
4. **衝突回滾機制有效性**：在批次檔中以 `%errorlevel%` 捕獲 Git 錯誤，並用 `git rebase --abort` 取消 rebase 行為，能有效保持工作區的潔淨。同時以 `exit /b 1` 中斷批次檔，避免了在 Git 衝突下強行啟動 Astro dev server 或執行 `sync-novels.js` 所可能帶來的寫入衝突。
5. **編譯驗證成功**：`npm run build` 能產出 83 個靜態網頁且無編譯期錯誤，說明當前 content 下的 markdown frontmatter 完全符合 `src/content/config.ts` 的 Zod schema 要求，專案具備生產建置的健壯性。

---

## 3. Caveats (潛在風險與批判性思考 - 業界顧問視角)
做為資深業界顧問與批判性評審，本代理人從這套「Obsidian 雙向同步與一鍵匯入系統」中識別出 **5 個潛在風險與邏輯漏洞**，並將每項拆分為 **5 個關鍵小問題** 以供專案團隊省思：

### 3.1 風險一：檔案修改時間 (`mtimeMs`) 在 Git 與協同開發下的不可靠性
在協同開發中，Git pull、checkout 等操作會將檔案的修改時間重置為本地拉取時間。這可能導致本地舊檔案的 `mtime` 反而大於外部新檔案的 `mtime`，從而誤判同步方向，將本地舊內容反寫覆蓋外部 Obsidian 的新內容。
- **子問題 1**：Git checkout 或 pull 會重置檔案的 `mtime` 為當前系統時間，這會如何干擾同步腳本的時間戳判斷？
- **子問題 2**：在多台設備協同開發時，如何保證本地與外部 Obsidian 檔案的 `mtime` 順序不被 Git 拉取行為倒置？
- **子問題 3**：如果 `mtime` 失效，是否會引發錯誤的方向覆寫（例如本地空 frontmatter 或舊內容覆寫外部新編輯）？
- **子問題 4**：當前僅保留 3 個 `.bak` 備份，如果在連續同步的過程中多次錯誤判定，備份是否會被快速擠出而徹底遺失？
- **子問題 5**：是否應引入內容雜湊值 (Hash) 或 Git Commit 歷史記錄，來取代純粹的 `mtimeMs` 作為同步判定依據？

### 3.2 風險二：中文 Slug 引起的部署與 SEO 隱患
系統允許使用中文作為 Slug。然而，中文在 URL 百分比編碼、不同網頁伺服器（IIS/Apache/Nginx）的 URL 敏感度，以及靜態建置輸出到 GitHub Pages 時，皆容易因編碼不一致引發 404 錯誤，且對 SEO 友好度不佳。
- **子問題 1**：為什麼允許中文作為 URL Slug？這在不同伺服器與瀏覽器環境下是否存在相容性與 404 亂碼風險？
- **子问题 2**：如果多個檔案在淨化後（例如去除了標點符號與空格）指向了同一個 Slug，使用者在重複性提示時是否需要手動一個個修正，這會不會降低自動化效率？
- **子問題 3**：為什麼不採用拼音、英文翻譯或簡單的 UUID 作為備用的 URL 友善 Slug？
- **子問題 4**：如果使用者在 Keystatic 編輯器中修改了 Slug，這時 mappings 中的 key (原始檔案路徑) 不變，但 `slug` 變了，這會不會導致與外部 Obsidian 檔案的連結（透過舊 slug）全部中斷？
- **子問題 5**：淨化函數 `sanitizeSlug` 是否有針對特殊字元（如 `%` 或 `.`）的邊界測試，是否有繞過此正則的正則注入風險？

### 3.3 風險三：Git pull --rebase 衝突處理回滾不夠徹底（Dirty Tree 殘留）
雖然批次檔捕捉了 rebase 錯誤並執行了 abort，但如果使用者在執行腳本前本地有未提交的修改（Dirty Tree），Git pull 過程中可能會自動 stash。一旦 rebase 失敗並 abort，被 stash 的修改若沒有正確 pop 還原，可能會讓使用者誤以為程式碼丟失。
- **子問題 1**：如果本地工作區有未提交的修改 (Dirty Tree)，`git pull --rebase` 會如何反應？是否會直接報錯並終止？
- **子問題 2**：在 Dirty Tree 的情況下觸發失敗，這時調用 `git rebase --abort` 是否會顯示 `No rebase in progress` 的錯誤訊息？
- **子問題 3**：`git pull --rebase` 失敗時，是否有自動暫存（stash）本地修改的機制？如果有的話，abort 後會自動回復 stash 嗎？
- **子問題 4**：若衝突是因為多人在同一篇文章進行了修改，單純的 `rebase --abort` 只能保持本地原樣，這時使用者如果又去執行 `sync-novels.js`，是否會因為與遠端不一致而導致混亂？
- **子問題 5**：為什麼不先進行 `git status` 檢查，確認工作區乾淨後才允許拉取與同步？

### 3.4 風險四：Obsidian 雙向連結解析與還原（Restore）的脆弱性
在 `sync-novels.js` 中，雙向連結的還原是基於嚴格的 RegExp 匹配 `[別名](/shanzhuang/collection/slug#anchor)`。如果使用者在 Keystatic 編輯時無意間修改了連結格式（例如補全了網域名稱、修改了路徑或加了 query 參數），正則表達式就會匹配失敗，導致反寫回 Obsidian 時無法還原為雙括號 `[[連結]]`，從而破壞 Obsidian 的反向連結圖譜。
- **子問題 1**：正則表達式是否能相容帶有網域的絕對 URL（如 `https://...`）？
- **子問題 2**：如果使用者在 Keystatic 編輯時不小心插入了換行或空格到 URL 中，正則是否會直接失效？
- **子問題 3**：如果 `slugToOriginalName[lowerSlug]` 找不到對應的原始名稱（例如該文章在 sync-config 中被移除或改名），這時還原為 `[[slug]]` 是否會導致 Obsidian 產生無法識別的無效連結？
- **子問題 4**：當前的正則如何處理 Obsidian 的嵌入連結（例如 `![[圖片]]`）或塊引用（Block References, 如 `[[文章#^blockid]]`）？
- **子問題 5**：為什麼不使用結構化的 Markdown 解析器（如 Remark 或 Unified）來精確操作 AST，而是用脆弱的 RegExp 進行字串替換？

### 3.5 風險五：缺乏同步衝突鎖與併發保護 (Race Conditions)
如果使用者在運行 Astro dev server (Keystatic) 的同時手動執行一鍵同步或一鍵匯入，多個進程可能會在同一時間嘗試寫入 `sync-config.json` 或 Markdown 檔案，這可能造成 JSON 檔案損壞或同步內容毀損。
- **子問題 1**：當 `sync-novels.js` 運行時，是否有建立臨時鎖檔（如 `sync.lock`）來防止其他進程同時寫入 `sync-config.json`？
- **子問題 2**：如果使用者在一鍵同步的同時在 Keystatic 介面點擊了保存，會不會發生讀寫衝突？
- **子問題 3**：萬一發生 JSON 寫入中斷，導致 `sync-config.json` 損壞，系統有何自動修復或備份還原機制？
- **子問題 4**：如果有多個開發者在不同分支上各自執行了一鍵匯入，並各自更新了 `sync-config.json`，在 merge 時會不會產生極難解決的 JSON 衝突？
- **子問題 5**：如何確保這套基於 JSON 對照表的同步系統在大規模檔案（如 1000 篇小說章節）時的記憶體與執行效率？

---

## 4. Conclusion (審查結論)
- **Verdict (審查結論)**：**APPROVE**
- **結論支持**：實作工程師對需求 R1-R4 的修改在功能正確性、健壯性、防禦性設計、以及建置兼容性上皆完全達到要求。在 `git pull --rebase` 的衝突回滾與 `sync-novels.js` 中對未登記檔案的防禦性跳過方面皆展現了良好的工程細節。
- **後續改進建議**：團隊應在後續版本中逐步解決 `Caveats` 中所列出的 5 大風險，特別是引入 Hash 機制替代 `mtime`，並加強 Git Dirty Tree 的前置 Precheck。

---

## 5. Verification Method (獨立驗證方法)
其他代理人或使用者若要獨立驗證此成果，可採用以下方法：
1. **檢查 Keystatic 配置**：開啟 `keystatic.config.ts` 確認第 3-7 行的儲存設定。
2. **模擬未登記警告與同步**：
   - 在外部工作區的 `SOURCE_DIR` 中隨意建立一個 `test-file.md`，但不登記於 `sync-config.json`。
   - 執行 `node scripts/sync-novels.js`，確認控制台正確輸出黃色警告文字，且其餘檔案同步流程照常完成（不崩潰）。
3. **模擬一鍵匯入**：
   - 執行 `一鍵匯入.bat`，選擇剛剛的 `test-file.md`，確認有顯示序號。
   - 測試輸入已有的 `title` 或 `slug`，確認有防重阻斷。
   - 完成匯入，確認 `sync-config.json` 被寫入且格式正確，並驗證 `src/content/` 下該檔案被自動生成且包含必填 frontmatter。
4. **全站建置測試**：
   - 執行 `npm run build`，確認完成 83 個網頁的靜態建置且無報錯。
