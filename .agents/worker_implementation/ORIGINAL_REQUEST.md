## 2026-06-25T01:02:49Z

請做為唐門山莊 Astro 專案的實作工程師，負責實作 R1-R4 專案需求。
請加載最小改動工程師領域技能（路徑：C:\Users\samww\.gemini\config\skills\agency-engineering-minimal-change-engineer\SKILL.md），秉持精準修改、拒絕過度重構的原則。

MANDATORY INTEGRITY WARNING — include this verbatim in the Worker's dispatch prompt:
> DO NOT CHEAT. All implementations must be genuine. DO NOT
> hardcode test results, create dummy/facade implementations, or
> circumvent the intended task. A Forensic Auditor will independently
> verify your work. Integrity violations WILL be detected and your
> work WILL be rejected.

【實作細節指引】

1. **R1. Keystatic 全域 GitHub 儲存配置**
   - 修改 `keystatic.config.ts` 中的 `storage` 配置：
     ```typescript
     storage: {
       kind: 'github',
       repo: 'meng10730/meng10730.github.io',
     },
     ```

2. **R2. 互動式文章匯入系統**
   - 建立 Node.js 交互式命令列腳本 `scripts/import-novel.js` 與本機批次檔 `一鍵匯入.bat`。
   - `scripts/import-novel.js` 需具備以下邏輯：
     - 讀取並解析 `sync-config.json`（取得外部 Obsidian 工作區路徑與 mappings）。
     - 掃描外部小說原始目錄中的所有 Markdown 檔案（排除 `sync-config.json` mappings 中已登記的檔案，且忽略系統/隱藏檔案）。
     - 若無未登記檔案，印出提示訊息並優雅退出。
     - 若有，展示帶有數字編號的選單。
     - 引導使用者輸入序號來選擇檔案。
     - 依序提問使用者並支援預設值：
       * 文章標題（Title，預設為移除前置數字與延伸副檔名的檔名）。
       * 網址別名（Slug，預設為檔案檔名但移除敏感字元，只允許中英數、減號 `-` 與底線 `_`。請實作嚴格的 sanitize過濾）。
       * 所屬分類（Category/Collection，支援：`novels`, `worldview`, `characters`, `factions`, `guoxue`）。
     - 確認輸入無誤後，將此新映射寫回並更新 `sync-config.json` 的 mappings。
     - 自動調用 `node scripts/sync-novels.js` 執行首次單向同步（外部 -> 本地），生成 Astro Schema 所需的 Frontmatter 必填欄位（例如將 title 賦值給 title，並確保 description 與 pubDate 欄位具有合理的預設值以防止編譯崩潰）。
   - `一鍵匯入.bat` 需加入 `@echo off`、`chcp 65001 > nul`（解決中文亂碼問題），並執行 `node scripts/import-novel.js`。

3. **R3. 同步警告機制優化**
   - 修改 `scripts/sync-novels.js`。
   - 當掃描發現外部工作區有未在對照表登記的新 Markdown 檔案時，在終端機中僅印出黃色警告日誌提示「有新文章可執行一鍵匯入」（例如使用 ANSI 色彩 `\x1b[33m`），但**不要**執行 `process.exit(1)` 中斷，允許其餘已登記文章正常進行雙向同步與滾動備份（最多保留 3 份）。

4. **R4. 啟動與同步的自動 Git 拉取防禦**
   - 修改 `開啟編輯器.bat` 與 `一鍵同步.bat`。
   - 在執行同步或啟動開發伺服器前，前置執行 `git pull --rebase` 以取得線上最新編輯。
   - 若發生衝突（`errorlevel` 不為 0），則必須調用 `git rebase --abort` 來保護本地狀態，且**不**執行後續命令，並優雅退出引導開發者手動解決。

5. **實作後檢測**：
   - 執行 `npm run build` 進行全站驗證，確認是否能正常完成全站 83 個網頁建置（退出代碼 0）。
