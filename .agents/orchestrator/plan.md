# Project Plan - 唐門山莊 Astro 專案優化

## 專案目標
本專案旨在為唐門山莊 Astro 網站實作 Keystatic 全域 GitHub 儲存配置、互動式文章匯入系統、優化同步警告機制，以及加入啟動與同步的自動 Git 拉取防禦。

---

## 業界顧問嚴格審查：5 大潛在風險與邏輯漏洞

針對本專案的規畫與需求，提出以下 5 個業界級的潛在風險與邏輯漏洞，並給出建議防禦策略：

1. **GitHub 儲存模式對本地開發的阻斷性 (R1)**
   - *漏洞*：將 keystatic.config.ts 的 storage kind 全面設為 'github' 後，本地 localhost 執行 CMS 編輯時必須取得 GitHub OAuth 授權。若無配置對應的環境變數（如 Client ID/Secret）或無網際網路連線，本地編輯將完全癱瘓。
   - *防禦*：應引導配置環境變數，或在代碼中為 localhost 保留適當的 fallback/提示機制，否則開發人員在離線或無 API 密鑰時無法使用 CMS。

2. **背景自動 Git Pull (--rebase) 衝突的優雅中斷與復原 (R4)**
   - *漏洞*：在「開啟編輯器.bat」與「一鍵同步.bat」前置加入自動 `git pull --rebase`。若本地與線上皆有不相容的修改，`rebase` 將會失敗並停在衝突解決階段。若無對應的自動檢測與提示，開發人員可能無法察覺為何命令列卡住或後續操作出錯。
   - *防禦*：批次檔應檢測 git 命令的 return code。若 rebase 失敗，應立刻停止執行後續同步/編輯命令，並印出醒目的衝突解決教學（如 `git rebase --abort` 或手動處理）。

3. **未登記文章的非阻塞警告與雙向同步漏洞 (R3)**
   - *漏洞*：`sync-novels.js` 會進行雙向同步與滾動備份。當發現未登記檔案時，僅印出黃色警告但不中斷。此時，若雙向同步邏輯包含「清理專案中未登記但存在的檔案」，可能會把專案內已編輯但未正確配置的文章意外刪除。
   - *防禦*：在實作 non-blocking 警告時，必須仔細審查 `sync-novels.js` 的檔案刪除或覆寫邏輯，確保不會誤殺專案 src 目錄下或外部暫存區的任何檔案。

4. **Slug 敏感字元去除規則與 Astro 路由相容性 (R2)**
   - *漏洞*：R2 要求 Slug 預設為檔案檔名但去除敏感字元。若去除規則過於粗糙或包含非標準字元（例如未處理空白、特殊標點符號、斜線或中文字），將會導致 Astro 在生成靜態網頁（Static SSG）時發生路由解析錯誤，甚至 build 失敗。
   - *防禦*：必須實作嚴謹的 Slug 消毒規則（例如僅保留英數字、中文字、連字號，並將空白轉換為 `-`），同時排除作業系統不支援的檔案字元。

5. **匯入外部小說的 YAML Frontmatter Schema 檢核缺失 (R2)**
   - *漏洞*：將外部小說匯入並自動生成 Frontmatter 寫入 `src/content/` 中。Astro 網站對 Content Collections 有嚴格的 Schema 限制（例如必須有 name、publishDate 等）。若匯入腳本未確實將必填欄位補齊，會直接導致 `npm run build` 出現驗證錯誤，無法完成 83 個網頁的建置。
   - *防禦*：`import-novel.js` 必須針對 Astro collection 的 schema 進行必填欄位對應（例如將 title 映射為 name，並自動填寫合理的預設值如發布時間、草稿狀態等）。

---

## 專案里程碑規劃

本專案採用 **Project Pattern (Dual Track)**，分為實作軌與測試軌。

### 實作軌里程碑 (Implementation Track)
- **Milestone 1**: Keystatic 全域 GitHub 儲存配置 (R1)
- **Milestone 2**: 同步警告機制優化 (R3) (較低風險，優先執行以穩定同步基底)
- **Milestone 3**: 互動式文章匯入系統實作 (R2)
- **Milestone 4**: 啟動與同步的自動 Git 拉取防禦 (R4)
- **Milestone 5**: 全站測試與 E2E 驗收 (Pass 100% E2E + Victory Audit)

### 測試軌里程碑 (E2E Testing Track)
- 建立 E2E 測試環境與覆蓋 Tier 1 - Tier 4 測試案例，生成 `TEST_READY.md`。

---

## 驗收條件與驗證計畫
- **建置驗證**：在完成每項里程碑後，執行 `npm run build` 驗證是否正常生成 83 個網頁（Exit Code 0）。
- **功能驗證**：
  - 驗證 keystatic 配置文件中 kind 是否為 github。
  - 模擬未登記檔案存在時，執行同步腳本，驗證其是否僅發出黃色警告且正常完成其餘雙向同步。
  - 執行互動式匯入腳本，輸入文章，驗證 sync-config.json 更新與 YAML frontmatter 生成之正確性。
  - 模擬 Git 衝突，驗證拉取防禦是否能優雅中斷。
