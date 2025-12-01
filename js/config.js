/**
 * 專案設定檔
 * 定義語言、方案、以及對應的 Excel 資料來源路徑
 */

// 語言設定
// key: 程式內部使用的代碼 (zh, en, ja)
// value: 顯示名稱與對應的資料夾名稱
const CONFIG = {
  languages: {
    zh: {
      label: "中文",
      flag: "🇹🇼",
      folderName: "zh",
    },
    en: {
      label: "英文",
      flag: "🇺🇸",
      folderName: "en",
    },
    ja: {
      label: "日文",
      flag: "🇯🇵",
      folderName: "ja",
    }
  },
  
  // 預設選擇
  defaultLang: "zh",
  defaultPlan: "plan1"
};

// 方案與主題設定
const PLANS = {
  plan1: {
    id: "plan1",
    label: "方案二",
    config: {
      asr: "Whisper Turbo",
      llm: "Llama3.1-TADIE-8B",
      tts: "Kokoro TTS",
      rag: "multilingual-e5-base",
      intent: "CKIP Transformers"
    },
    topics: [
      {
        id: "food",
        title: "美食問題",
        // 動態產生路徑：audio/{語言資料夾}/方案二/美食店家/美食問題.xlsx
        getExcelPath: (langFolder) => `audio/${langFolder}/方案二/美食店家/美食問題.xlsx`
      },
      {
        id: "hotel",
        title: "飯店QA",
        getExcelPath: (langFolder) => `audio/${langFolder}/方案二/飯店QA/飯店QA.xlsx`
      }
    ]
  },
  plan2: {
    id: "plan2",
    label: "方案四",
    config: {
      asr: "Whisper Turbo",
      llm: "Gemma3-4B",
      tts: "Kokoro TTS",
      rag: "multilingual-e5-base",
      intent: "CKIP Transformers"
    },
    topics: [
      {
        id: "food",
        title: "美食問題",
        getExcelPath: (langFolder) => `audio/${langFolder}/方案四/美食店家/美食問題.xlsx`
      },
      {
        id: "hotel",
        title: "飯店QA",
        getExcelPath: (langFolder) => `audio/${langFolder}/方案四/飯店QA/飯店QA.xlsx`
      }
    ]
  }
};
