import https from 'https';

const REPO = 'meng10730/meng10730.github.io';
const API_URL = `https://api.github.com/repos/${REPO}/actions/runs`;

// 輔助函數：發送 HTTP GET 請求
function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) TangmenShanzhuang/1.0'
      }
    };
    https.get(url, options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error('JSON 解析失敗'));
          }
        } else {
          reject(new Error(`HTTP 錯誤: ${res.statusCode}`));
        }
      });
    }).on('error', reject);
  });
}

async function checkStatus() {
  console.log('📡 正在向 GitHub 查詢最近一次的自動部署流程...');
  
  let attempts = 0;
  const maxAttempts = 30; // 5 分鐘超時 (30 次 * 10秒)
  let lastRunId = null;

  while (attempts < maxAttempts) {
    try {
      const result = await fetchJSON(API_URL);
      const runs = result.workflow_runs;
      if (!runs || runs.length === 0) {
        console.log('⚠️  未在 GitHub 上發現任何 Actions 紀錄。');
        return;
      }

      // 取出最新一次的 Run (通常在最前面)
      const latestRun = runs[0];

      // 第一次查詢時，記錄下這個 Run 的 ID
      if (!lastRunId) {
        lastRunId = latestRun.id;
        console.log(`✓ 偵測到最新部署流程: ID ${latestRun.id}`);
        console.log(`🔗 流程連結: ${latestRun.html_url}`);
        console.log(`狀態：[${latestRun.status}]，正在為您追蹤，請勿關閉此視窗...\n`);
      }

      // 如果發現了更新的 Run，或者是同一個 Run 的狀態
      const currentRun = runs.find(r => r.id === lastRunId) || latestRun;
      
      if (currentRun.status === 'completed') {
        console.log('\n====================================================');
        if (currentRun.conclusion === 'success') {
          console.log('🎉 [成功] GitHub Actions 自動部署已順利完成！');
          console.log('💡 莊主，您的最新修改已上線！現在重新整理網頁即可查看！');
        } else {
          console.log(`❌ [失敗] GitHub Actions 自動部署結束，但結果為：${currentRun.conclusion}`);
          console.log(`請前往檢查錯誤原因: ${currentRun.html_url}`);
        }
        console.log('====================================================\n');
        return;
      }

      // 如果仍在進行中，輸出進度點並等待
      process.stdout.write(`⏳ 部署進行中，當前狀態：[${currentRun.status}] (已等待 ${attempts * 10} 秒)...      \r`);
      
    } catch (err) {
      // 網路暫時出錯不中斷，繼續嘗試
      process.stdout.write(`⚠️  網路請求暫時失敗，正在重試... (${err.message})      \r`);
    }

    attempts++;
    await new Promise(resolve => setTimeout(resolve, 10000)); // 每 10 秒輪詢一次
  }

  console.log('\n⏰ [超時] 部署時間過長，已自動暫停追蹤。請自行上網查看部署狀態。');
}

checkStatus().catch(err => {
  console.error('\n❌ 追蹤部署狀態時發生錯誤:', err.message);
});
