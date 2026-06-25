# 唐門山莊 Astro 專案探索與修改策略報告 (handoff.md)

本報告詳細分析專案目前架構與程式碼，並針對 R1-R5 提供修改策略，同時作為資深顧問對此同步與發布計畫提出 5 個關鍵風險與邏輯漏洞審查。

---

## 1. Observation (觀察事實)

以下為專案中相關檔案的具體內容與路徑觀察：

### A. Keystatic 儲存配置
*   **檔案路徑**：`c:\workspace\個人網站架設\keystatic.config.ts`
*   **目前配置** (第 4-6 行)：
    ```typescript
    storage: {
      kind: 'local',
    },
    ```

### B. 同步腳本的防禦與備份邏輯
*   **檔案路徑**：`c:\workspace\個人網站架設\scripts\sync-novels.js`
*   **未登記檔案防禦中斷邏輯** (第 199-227 行)：
    ```javascript
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
      // ... 輸出建議配置範例 ...
      process.exit(1);
    }
    ```
*   **備份滾動邏輯** (第 302-325 行)：
    ```javascript
    if (fs.existsSync(fullSourcePath)) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = `${fullSourcePath}.${timestamp}.bak`;
      fs.copyFileSync(fullSourcePath, backupPath);

      const dir = path.dirname(fullSourcePath);
      const baseName = path.basename(fullSourcePath);
      const bakFiles = fs.readdirSync(dir)
        .filter(f => f.startsWith(baseName) && f.endsWith('.bak') && f !== baseName)
        .map(f => ({
          name: f,
          path: path.join(dir, f),
          mtime: fs.statSync(path.join(dir, f)).mtimeMs
        }));

      bakFiles.sort((a, b) => a.mtime - b.mtime);

      if (bakFiles.length > 3) {
        const filesToDelete = bakFiles.slice(0, bakFiles.length - 3);
        for (const f of filesToDelete) {
          fs.unlinkSync(f.path);
        }
      }
    }
    ```

### C. Astro 小說內容集合 Schema
*   **檔案路徑**：`c:\workspace\個人網站架設\src\content\config.ts`
*   **小說集合定義** (第 30-40 行)：
    ```typescript
    const novels = defineCollection({
      type: 'content',
      schema: z.object({
        title: z.string(),                                    // 小說標題
        description: z.string(),                              // 簡介
        genre: z.array(z.string()).default([]),               // 類型標籤（武俠、仙俠…）
        status: z.enum(['ongoing', 'completed', 'hiatus']).default('ongoing'), // 連載狀態
        pubDate: z.coerce.date(),                             // 開始連載日期
        cover: z.string().optional(),                         // 封面圖路徑（選填）
      }),
    });
    ```
*   **必填欄位**：
    1.  `title`: 必填 (字串，無 default 或 optional)。
    2.  `description`: 必填 (字串，無 default 或 optional)。
    3.  `pubDate`: 必填 (強制轉 Date 類型，無 default 或 optional)。
*   **非必填欄位**：
    *   `genre`: 非必填 (預設值為 `[]`)。
    *   `status`: 非必填 (預設值為 `'ongoing'`)。
    *   `cover`: 非必填 (標示為 `.optional()`)。

### D. 同步設定檔與外部小說目錄的關係
*   **檔案路徑**：`c:\workspace\個人網站架設\sync-config.json`
*   **屬性結構**：
    *   `workspacePath`: 本地外部的 Obsidian 工作區路徑，目前設定為 `"C:\\workspace\\長生劫_小說工作區"`。
    *   `mappings`: 設定檔映射對照表。Key 為相對於 `SOURCE_DIR` 的相對路徑（`scripts/sync-novels.js` 第 124 行定義 `SOURCE_DIR` 為 `workspacePath/00_世界觀與劇本/01_Creative_Source`）。
    *   每個映射的物件包含對應的 Collection 名稱、Astro 內檔案 Slug、Frontmatter 標題與其他欄位。

### E. 啟動與同步批次檔
*   **檔案路徑**：
    *   `c:\workspace\個人網站架設\開啟編輯器.bat`
    *   `c:\workspace\個人網站架設\一鍵同步.bat`
*   **目前內容**：
    *   兩者在執行 Dev 伺服器或結束前，都會先執行 `node scripts/sync-novels.js` 進行同步，但均未包含 `git pull` 等遠端同步操作。

---

## 2. Logic Chain (推理鏈)

基於上述觀察，我們可以推導出以下結論與具體修改策略：

1.  **R1 (Keystatic 儲存切換)**：
    *   因為現行 `storage.kind` 為 `'local'`，要將儲存轉移至 GitHub，必須改寫為 `kind: 'github'`，並配合配置 `repo: 'meng10730/meng10730.github.io'`。
    *   在部署或本地運行時，Keystatic 會需要額外的 GitHub OAuth/Personal Access Token 來獲取寫入權限。
2.  **R2 (同步防禦與備份)**：
    *   `sync-novels.js` 已具備未登記檔案的阻斷功能，如果外部發現未登記檔案，會強制執行 `process.exit(1)`。
    *   備份滾動在 `shouldSyncLocalToExternal` (反寫回 Obsidian) 觸發時運作。它會把備份寫成 `.bak` 結尾的檔案。由於 `scanMarkdownFiles` 限制了只掃描 `.md` 檔案，因此這些 `.bak` 備份檔不會被誤判為未登記檔案，此處邏輯是安全的。
3.  **R3 (Schema 必填欄位對齊)**：
    *   Astro Schema 的 `novels` 必填欄位為 `title`、`description` 和 `pubDate`。
    *   而在 `sync-novels.js` 中，如果外部 mappings 缺少這三個欄位且未透過其他手段補充，產生的 Markdown 檔案會導致 Astro 編譯報錯。因此同步設定檔必須嚴格填寫這三個屬性。
4.  **R4 (Sync-Config 機制)**：
    *   `sync-config.json` 的 Key 確實對應 `長生劫_小說工作區/00_世界觀與劇本/01_Creative_Source/` 底下的相對路徑，該結構極度依賴外部目錄層級的穩定性。
5.  **R5 (批次檔 Git 整合與衝突保護)**：
    *   為了避免本機與遠端 Keystatic 編輯內容產生衝突，在執行 `sync-novels.js` 之前，應先拉取最新的遠端代碼。
    *   由於 `git pull --rebase` 可能因衝突而進入 rebase 狀態，如果不中斷，後續腳本繼續執行將導致本地檔案毀損。因此，必須檢測 `errorlevel`，在失敗時調用 `git rebase --abort` 回滾狀態，並終止批次檔運行。

---

## 3. Caveats (注意事項與假設)

1.  **Git 檔案修改時間戳記失效假定**：
    *   `git pull --rebase` 會下載遠端修改。Git 本身**不保留**檔案原始的建立與修改時間戳記，拉取檔案時，檔案的 mtime 會被設定為「寫入本地磁碟的時間」（即 pull 的當下時間）。
    *   這意味著，一旦執行了 `git pull`，本地原本舊的 `src/content` 檔案可能會因為 mtime 更新而變得比外部 Obsidian 檔案「更晚（新）」，進而導致同步腳本誤判並反寫回外部，這可能會意外覆蓋外部 Obsidian 的最新修改。此風險未在原本設計中被解決。
2.  **Keystatic GitHub Mode 本地登入依賴**：
    *   將 Keystatic 改為 GitHub 儲存後，本地開發模式下（`npm run dev`）存取 `/keystatic` 必須具備 GitHub OAuth 認證設定，否則編輯器會無法登入與顯示。

---

## 4. Conclusion (結論與修改方案推薦)

### A. 具體修改方案建議

#### 1. Keystatic 設定修改 (`keystatic.config.ts`)
```typescript
// 將第 4-6 行修改為：
  storage: {
    kind: 'github',
    repo: 'meng10730/meng10730.github.io',
  },
```

#### 2. 批次檔安全插入 `git pull --rebase`

**`開啟編輯器.bat` 建議修改為：**
```cmd
@echo off
chcp 65001 > nul
echo ====================================================
echo   Changshengjie Novel CMS Startup Precheck
echo ====================================================
echo.

:: 先進行遠端同步拉取
echo [1/3] Pulling latest changes from remote...
git ls-remote --exit-code -h origin >nul 2>nul
if %errorlevel% neq 0 (
  echo [Warning] Offline mode: Skipping remote pull.
  goto RUN_SYNC
)

git pull --rebase
if %errorlevel% neq 0 (
  echo.
  echo [Error] Conflict detected during git pull --rebase!
  echo Aborting rebase to protect local state...
  git rebase --abort >nul 2>nul
  echo Please resolve conflicts manually in git before opening the editor.
  echo.
  pause
  exit /b 1
)

:RUN_SYNC
echo.
echo [2/3] Running bi-directional sync precheck, please wait...
node scripts/sync-novels.js
if %errorlevel% equ 0 goto SYNC_SUCCESS

echo.
echo [Warning] Precheck sync failed! Opening editor anyway...
echo Please check errors above if you notice synchronization discrepancies.
echo.
pause

:SYNC_SUCCESS
echo.
echo   [Info] Opening http://localhost:4321/keystatic
echo   [Info] Press Ctrl+C in this window to stop.
echo.

start http://localhost:4321/keystatic
npm run dev
```

**`一鍵同步.bat` 建議修改為：**
```cmd
@echo off
chcp 65001 > nul

echo ==========================================
echo    Changshengjie Novel Sync System
echo ==========================================
echo.

:: 先進行遠端同步拉取
echo [1/2] Pulling latest changes from remote...
git ls-remote --exit-code -h origin >nul 2>nul
if %errorlevel% neq 0 (
  echo [Warning] Offline mode: Skipping remote pull.
  goto RUN_SYNC
)

git pull --rebase
if %errorlevel% neq 0 (
  echo.
  echo [Error] Conflict detected during git pull --rebase!
  echo Aborting rebase to protect local state...
  git rebase --abort >nul 2>nul
  echo Please resolve conflicts manually in git first.
  echo.
  pause
  exit /b 1
)

:RUN_SYNC
echo.
echo [2/2] Running sync script, please wait...
node scripts/sync-novels.js
if %errorlevel% equ 0 goto SYNC_SUCCESS

echo.
echo [Error] Sync failed! Please check the error messages above.
echo.
pause
exit /b 1

:SYNC_SUCCESS
echo.
echo [Success] Sync completed successfully!
echo.
pause
```

---

### B. 🔒 業界顧問審查：5 個潛在風險與邏輯漏洞

針對現行與即將修改的計畫，以下提出 5 個關鍵風險：

1.  **Git Pull 後時間戳記失真導致「雙向覆寫衝突」**
    *   **漏洞描述**：`sync-novels.js` 使用 `fs.statSync(path).mtimeMs` 來決定誰覆蓋誰。當我們在批次檔中加入 `git pull --rebase` 時，所有被 Pull 下來的本地專案檔案其 mtime 都會變成「當前 Pull 的時間」（通常比外部 Obsidian 檔案更晚）。
    *   **後果**：同步腳本會誤認為本地 `src/content` 的檔案比較新，從而觸發 `shouldSyncLocalToExternal` 將舊的本地內容反寫回外部 Obsidian 檔案，導致 Obsidian 中的最新修改被無情覆寫。
2.  **Keystatic GitHub Mode 本地存取認證阻礙**
    *   **漏洞描述**：Keystatic 改成 `'github'` 儲存模式後，本地執行 `/keystatic` 時，不再是直接寫入本地檔案，而是改為發送 API 請求到 GitHub。
    *   **後果**：若本地沒有配置 `KEYSTATIC_GITHUB_CLIENT_ID` 和 `KEYSTATIC_GITHUB_CLIENT_SECRET` 環境變數，本地編輯器將會失效，無法正常讀取和編輯資料，導致 CMS 功能癱瘓。
3.  **無效連結降級導致「Obsidian 原始雙括號永久丟失」**
    *   **漏洞描述**：在 `sync-novels.js` 的 `syncCount` 階段（外部 -> 本地），若連結目標未註冊在 `sync-config.json` 中，會被轉換為 `<span class="broken-link">...</span>`（第 348 行）。
    *   **後果**：若本地發生編輯並觸發回寫（本地 -> 外部），這段 HTML 標籤會通過 `restoreObsidianLinks` 還原。然而 `restoreObsidianLinks`（第 62-80 行）只處理了 `class="broken-link"`，若該內容之後在 Keystatic 中被輕微編輯或移動，導致標籤結構改變，這段連結將永久遺失雙括號格式，損壞 Obsidian 內庫。
4.  **未登記檔案的「阻斷式拒絕服務」**
    *   **漏洞描述**：目前的防禦邏輯是「只要發現一個未登記檔案，就透過 `process.exit(1)` 中斷整個同步程序」。
    *   **後果**：當作者在 Obsidian 中新增了數個靈感草稿或暫存檔，且未即時在 `sync-config.json` 進行繁瑣的映射設定時，將導致整個唐門山莊網站完全無法進行同步與發布。這種全有全無（All-or-Nothing）的設計極度不便於寫作流程。
5.  **缺乏 Astro Schema 必填欄位的前置驗證**
    *   **漏洞描述**：`sync-novels.js` 在產出 Astro 檔案前，並沒有去校驗該 Collection 對應的 Schema 必填欄位是否存在。
    *   **後果**：如果 `sync-config.json` 的 mappings 沒有設定某個 `novels` 的 `description`，同步腳本仍會順利跑完並產生 md 檔。但隨後執行 `npm run dev` 或 Astro 編譯時，將會拋出 Zod schema 驗證失敗的編譯錯誤，導致網站崩潰。驗證環節被推遲到了編譯期，而非同步期。

---

## 5. Verification Method (驗證方法)

1.  **Keystatic 配置驗證**：
    *   修改後執行 `npx keystatic` 或啟動 Dev Server，觀察本地連線是否要求 GitHub 登入。
2.  **批次檔衝突保護驗證**：
    *   在本地隨意修改一個檔案並 commit。在遠端倉庫的同一個檔案進行不同的 commit，造成衝突。
    *   執行 `開啟編輯器.bat`，確認腳本是否在 `git pull --rebase` 時報錯，並自動呼叫 `git rebase --abort`，且**不**啟動 `npm run dev` 與瀏覽器。
3.  **防禦與備份邏輯驗證**：
    *   在 Obsidian 工作區創立一個未登記的 `.md` 檔案，執行 `一鍵同步.bat`，確認是否輸出 `❌ [同步中斷]` 錯誤並離開。

---
報告完畢。建議後續實施人員優先解決「Git Pull 後 mtime 混亂」之問題（可考慮在 mappings 中記錄上一次同步的 Hash 雜湊值而非時間戳記，或改採 Git Commit Hash 做為同步依據）。
