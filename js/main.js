/**
 * 主程式邏輯
 * 負責 UI 渲染、資料讀取與互動處理
 */

class App {
  constructor() {
    this.state = {
      currentLang: CONFIG.defaultLang,
      currentPlan: CONFIG.defaultPlan,
      currentAudioSource: null,
      dataCache: {} // cache[lang][plan][topicId] = rows[]
    };

    this.elements = {
      tablesContainer: document.getElementById("tables-container"),
      langTabsContainer: document.getElementById("lang-tabs"),
      planTabsContainer: document.getElementById("plan-tabs"),
      planInfoContainer: document.getElementById("plan-info"), // 新增
      globalAudio: document.getElementById("global-audio"),
      langLabel: document.getElementById("current-lang-label"),
      planLabel: document.getElementById("current-plan-label")
    };

    this.init();
  }

  init() {
    this.renderTabs();
    this.renderPlanInfo(); // 新增
    this.loadAndRenderCurrent();
    this.setupAudioListeners();
  }

  // === UI 渲染 ===

  renderTabs() {
    // 渲染語言 Tabs
    this.elements.langTabsContainer.innerHTML = Object.entries(CONFIG.languages)
      .map(([key, lang]) => `
        <button class="tab ${key === this.state.currentLang ? 'active' : ''}" 
                data-lang="${key}"
                onclick="app.switchLang('${key}')">
          <span class="flag">${lang.flag}</span>
          <span>${lang.label}</span>
        </button>
      `).join('');

    // 渲染方案 Tabs
    this.elements.planTabsContainer.innerHTML = Object.entries(PLANS)
      .map(([key, plan]) => `
        <button class="tab ${key === this.state.currentPlan ? 'active' : ''}" 
                data-plan="${key}"
                onclick="app.switchPlan('${key}')">
          ${plan.label}
        </button>
      `).join('');
  }

  // 新增：渲染方案配置資訊
  renderPlanInfo() {
    const plan = PLANS[this.state.currentPlan];
    if (!plan || !plan.config) {
      this.elements.planInfoContainer.innerHTML = "";
      return;
    }

    const { config } = plan;
    
    this.elements.planInfoContainer.innerHTML = `
      <div class="plan-config-grid">
        <div class="config-item">
          <span class="config-label">ASR 模組</span>
          <span class="config-value">${config.asr}</span>
        </div>
        <div class="config-item">
          <span class="config-label">LLM 模組</span>
          <span class="config-value">${config.llm}</span>
        </div>
        <div class="config-item">
          <span class="config-label">TTS 模組</span>
          <span class="config-value">${config.tts}</span>
        </div>
        <div class="config-item">
          <span class="config-label">RAG 模組</span>
          <span class="config-value">${config.rag}</span>
        </div>
        <div class="config-item">
          <span class="config-label">意圖分類</span>
          <span class="config-value">${config.intent}</span>
        </div>
      </div>
    `;
  }

  updateLabels() {
    // 更新顯示目前選擇的標籤文字 (Optional, if UI needs it)
  }

  renderLoading(message) {
    this.elements.tablesContainer.innerHTML = `
      <div class="loading">
        <div class="spinner"></div>
        <p>${message}</p>
      </div>
    `;
  }

  renderError(message) {
    this.elements.tablesContainer.innerHTML = `
      <div class="error">
        <p>⚠️ ${message}</p>
      </div>
    `;
  }

  // === 資料處理 ===

  ensureCacheStructure(lang, plan) {
    if (!this.state.dataCache[lang]) this.state.dataCache[lang] = {};
    if (!this.state.dataCache[lang][plan]) this.state.dataCache[lang][plan] = {};
  }

  async loadTopicExcel(lang, plan, topic) {
    const langCfg = CONFIG.languages[lang];
    
    this.ensureCacheStructure(lang, plan);

    // 如果快取已有資料，直接返回
    if (this.state.dataCache[lang][plan][topic.id]) {
      return;
    }

    const excelPath = topic.getExcelPath(langCfg.folderName);

    try {
      const response = await fetch(excelPath);
      if (!response.ok) {
        console.warn(`找不到檔案：${excelPath}`);
        this.state.dataCache[lang][plan][topic.id] = [];
        return;
      }

      const arrayBuffer = await response.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: "array" });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      
      const json = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

      if (json.length > 0) {
        console.log(`[${lang}-${plan}-${topic.id}] Excel 欄位偵測:`, Object.keys(json[0]));
      }

      // 取得 Excel 所在的資料夾路徑，用來串接音檔路徑
      // 例如: audio/中文/方案一/美食問題/美食問題.xlsx -> audio/中文/方案一/美食問題
      const excelDir = excelPath.substring(0, excelPath.lastIndexOf('/'));

      const rows = json.map(row => {
        // 嘗試多種可能的欄位名稱
        // 新增: "音檔連結" (User's Excel)
        let audioFile = row["音檔連結"] || row["音檔位址"] || row["音檔"] || row["audio"] || row["Audio"] || row["file"] || row["File"] || "";
        
        if (typeof audioFile === 'string') {
          audioFile = audioFile.trim();
        }
        
        // 路徑處理：若不是 http 或 / 開頭，視為相對路徑
        if (audioFile && !audioFile.startsWith("http") && !audioFile.startsWith("/")) {
          audioFile = `${excelDir}/${audioFile}`;
        }

        // 針對本地路徑進行 URL 編碼 (解決中文路徑問題)
        if (audioFile && !audioFile.startsWith("http")) {
            audioFile = encodeURI(audioFile);
        }

        return {
          question: row["問題"] || row["question"] || row["Question"] || row["input"] || "",
          asr: row["ASR辨識結果"] || row["ASR"] || row["asr"] || row["辨識結果"] || "",
          // 新增: "LLM回覆" (User's Excel)
          llm: row["LLM回覆"] || row["LLM回覆結果"] || row["LLM"] || row["llm"] || row["回覆結果"] || row["response"] || "",
          audio: audioFile
        };
      });

      this.state.dataCache[lang][plan][topic.id] = rows;

    } catch (err) {
      console.error("讀取 Excel 失敗：", excelPath, err);
      this.state.dataCache[lang][plan][topic.id] = [];
    }
  }

  async loadAndRenderCurrent() {
    const { currentLang, currentPlan } = this.state;
    const langCfg = CONFIG.languages[currentLang];
    const planCfg = PLANS[currentPlan];

    if (!langCfg || !planCfg) {
      this.renderError("設定錯誤：找不到對應的語言或方案");
      return;
    }

    this.renderLoading(`正在讀取 ${langCfg.label} - ${planCfg.label} 資料...`);

    // 載入該方案下的所有主題
    const promises = planCfg.topics.map(topic => 
      this.loadTopicExcel(currentLang, currentPlan, topic)
    );

    await Promise.all(promises);

    this.renderTables(currentLang, currentPlan);
  }

  renderTables(lang, plan) {
    const planCfg = PLANS[plan];
    this.elements.tablesContainer.innerHTML = "";

    planCfg.topics.forEach(topic => {
      const rows = this.state.dataCache[lang][plan][topic.id] || [];
      
      const section = document.createElement("div");
      section.className = "table-section";
      
      // Header
      section.innerHTML = `
        <div class="table-header">
          <div class="table-title">${topic.title}</div>
          <span class="badge">${rows.length} 筆資料</span>
        </div>
      `;

      // Table Wrapper
      const wrapper = document.createElement("div");
      wrapper.className = "table-wrapper";

      if (rows.length === 0) {
        wrapper.innerHTML = `<div class="no-data">此區塊目前沒有資料</div>`;
      } else {
        const table = document.createElement("table");
        table.innerHTML = `
          <thead>
            <tr>
              <th class="col-question">問題</th>
              <th class="col-asr">ASR 辨識結果</th>
              <th class="col-llm">LLM 回覆結果</th>
              <th class="col-audio">音檔</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map((row, index) => `
              <tr onclick="this.classList.toggle('expanded')" title="點擊展開/收合完整內容">
                <td>
                  <div class="cell-content">${row.question}</div>
                </td>
                <td class="col-asr">
                  <div class="cell-content">${row.asr}</div>
                </td>
                <td class="col-llm">
                  <div class="cell-content">${row.llm}</div>
                </td>
                <td class="col-audio">
                  ${row.audio ? `
                    <button class="play-btn" data-src="${row.audio}" aria-label="播放音檔">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="icon-play">
                        <path fill-rule="evenodd" d="M4.5 5.653c0-1.426 1.529-2.33 2.779-1.643l11.54 6.348c1.295.712 1.295 2.573 0 3.285L7.28 19.991c-1.25.687-2.779-.217-2.779-1.643V5.653z" clip-rule="evenodd" />
                      </svg>
                    </button>
                  ` : '<span style="color:var(--text-muted)">-</span>'}
                </td>
              </tr>
            `).join('')}
          </tbody>
        `;
        wrapper.appendChild(table);
      }

      section.appendChild(wrapper);
      this.elements.tablesContainer.appendChild(section);
    });

    this.attachPlayHandlers();
  }

  // === 互動邏輯 ===

  switchLang(lang) {
    if (this.state.currentLang === lang) return;
    this.state.currentLang = lang;
    this.stopAudio();
    this.renderTabs();
    this.loadAndRenderCurrent();
  }

  switchPlan(plan) {
    if (this.state.currentPlan === plan) return;
    this.state.currentPlan = plan;
    this.stopAudio();
    this.renderTabs();
    this.renderPlanInfo(); // 新增：切換方案時更新配置資訊
    this.loadAndRenderCurrent();
  }

  // === 音訊處理 ===

  setupAudioListeners() {
    const audio = this.elements.globalAudio;
    
    audio.addEventListener('ended', () => {
      this.updatePlayButtonState(null);
      this.state.currentAudioSource = null;
    });

    audio.addEventListener('pause', () => {
      // 暫停時不一定代表結束，但為了簡單起見，我們移除播放狀態
      // 如果需要更精細的暫停/播放圖示切換，可以在這裡處理
      this.updatePlayButtonState(null);
    });

    audio.addEventListener('play', () => {
      this.updatePlayButtonState(this.state.currentAudioSource);
    });

    // 新增：播放進度更新
    audio.addEventListener('timeupdate', () => {
      if (this.state.currentAudioSource && !audio.paused) {
        const progress = (audio.currentTime / audio.duration) * 100;
        this.updateRowProgress(this.state.currentAudioSource, progress);
      }
    });
  }

  updateRowProgress(src, progress) {
    const activeBtns = document.querySelectorAll(`.play-btn[data-src="${src}"]`);
    activeBtns.forEach(btn => {
      const row = btn.closest('tr');
      if (row) {
        // 使用 linear-gradient 模擬進度條背景
        // #e0e7ff 是 var(--primary-light) 的顏色
        row.style.backgroundImage = `linear-gradient(to right, #e0e7ff ${progress}%, transparent ${progress}%)`;
        row.style.backgroundRepeat = 'no-repeat';
      }
    });
  }

  attachPlayHandlers() {
    const buttons = this.elements.tablesContainer.querySelectorAll(".play-btn");
    buttons.forEach(btn => {
      btn.addEventListener("click", (e) => {
        // 阻止冒泡，避免觸發 row click (如果有)
        e.stopPropagation();
        const src = btn.dataset.src;
        this.playAudio(src);
      });
    });
  }

  playAudio(src) {
    console.log("嘗試播放音檔:", src);
    const audio = this.elements.globalAudio;

    // 如果點擊同一個音檔
    if (this.state.currentAudioSource === src) {
      if (!audio.paused) {
        // 正在播放 -> 暫停
        audio.pause();
      } else {
        // 暫停中 -> 重新播放
        audio.currentTime = 0;
        audio.play().catch(err => console.error("播放失敗:", err));
      }
      return;
    }

    // 播放新的音檔
    this.state.currentAudioSource = src;
    audio.src = src;
    audio.play().catch(err => console.error("播放失敗:", err));
  }

  stopAudio() {
    const audio = this.elements.globalAudio;
    audio.pause();
    audio.currentTime = 0;
    this.state.currentAudioSource = null;
    this.updatePlayButtonState(null);
  }

  updatePlayButtonState(activeSrc) {
    // 定義 SVG 圖示
    const playIcon = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="icon-play">
        <path fill-rule="evenodd" d="M4.5 5.653c0-1.426 1.529-2.33 2.779-1.643l11.54 6.348c1.295.712 1.295 2.573 0 3.285L7.28 19.991c-1.25.687-2.779-.217-2.779-1.643V5.653z" clip-rule="evenodd" />
      </svg>`;
      
    const pauseIcon = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="icon-pause">
        <path fill-rule="evenodd" d="M6.75 5.25a.75.75 0 01.75-.75H9a.75.75 0 01.75.75v13.5a.75.75 0 01-.75.75H7.5a.75.75 0 01-.75-.75V5.25zm7.5 0A.75.75 0 0115 4.5h1.5a.75.75 0 01.75.75v13.5a.75.75 0 01-.75.75H15a.75.75 0 01-.75-.75V5.25z" clip-rule="evenodd" />
      </svg>`;

    // 重置所有按鈕為 Play 圖示
    const allBtns = document.querySelectorAll('.play-btn');
    allBtns.forEach(btn => {
      btn.classList.remove('playing');
      // 只有當目前的 innerHTML 不是 playIcon 時才重置，避免閃爍 (雖然這裡直接重置也無妨)
      if (!btn.querySelector('.icon-play')) {
        btn.innerHTML = playIcon;
      }
      
      // 清除列背景 (Progress Bar)
      const row = btn.closest('tr');
      if (row) {
        row.style.backgroundImage = '';
      }
    });

    if (activeSrc) {
      // 找到對應的按鈕加上 playing class 並切換為 Pause 圖示
      const activeBtns = document.querySelectorAll(`.play-btn[data-src="${activeSrc}"]`);
      activeBtns.forEach(btn => {
        btn.classList.add('playing');
        btn.innerHTML = pauseIcon;
      });
    }
  }
}

// 初始化應用程式
const app = new App();
