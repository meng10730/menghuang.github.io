## 2026-06-25T01:01:29Z
請探索唐門山莊 Astro 專案以確認 R1-R4 的具體修改策略。
請詳細閱讀並分析以下檔案與機制：
1. 檢視 `keystatic.config.ts` 中的目前 storage 配置，看看需要改動哪些欄位（包含 kind 改為 'github'，repo 改為 'meng10730/meng10730.github.io'）。
2. 檢視 `scripts/sync-novels.js` 的目前實作，特別是未登記檔案的防禦/中斷邏輯（尋找哪裡丟出了 Error 或 exit），以及備份滾動邏輯。
3. 尋找與檢視 Astro 的 novels content collection schema 定義（如 `src/content/config.ts`），確認必填欄位有哪些（例如 name, publishDate 等）。
4. 檢視 `sync-config.json` 的結構，與外部小說目錄的關係。
5. 檢視 `開啟編輯器.bat` 與 `一鍵同步.bat` 的目前內容，確定如何安全插入 `git pull --rebase`，並防止在發生衝突時因繼續執行而破壞本地狀態。

請在你的工作目錄 `c:\workspace\個人網站架設\.agents\explorer_m1_m4\` 中建立 `progress.md` 和 `handoff.md`。並回報 handoff.md 的絕對路徑與主要發現。
