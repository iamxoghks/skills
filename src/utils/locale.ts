export type ReceiptLocale = "en" | "ko" | "ja" | "zh";

export interface ReceiptLabels {
  location: string;
  session: string;
  date: string;
  item: string;
  qty: string;
  points: string;
  input: string;
  output: string;
  reasoning: string;
  cached: string;
  cacheWrite: string;
  cacheRead: string;
  subtotal: string;
  total: string;
  cashier: string;
  footerMessage: string;
  printYourOwn: string;
  generatedBy: string;
  breakdowns: Record<string, string>;
}

const LABELS: Record<ReceiptLocale, ReceiptLabels> = {
  en: {
    location: "Location",
    session: "Session",
    date: "Date",
    item: "ITEM",
    qty: "QTY",
    points: "POINTS",
    input: "Input",
    output: "Output",
    reasoning: "Reasoning",
    cached: "Cached",
    cacheWrite: "Cache write",
    cacheRead: "Cache read",
    subtotal: "SUBTOTAL",
    total: "TOTAL",
    cashier: "CASHIER",
    footerMessage: "Proof of work, but cute.",
    printYourOwn: "Print your own Codex receipts:",
    generatedBy: "Print your own",
    breakdowns: {
      "User prompts": "User Prompts",
      "Assistant replies": "Assistant Replies",
      "Tool calls": "Tool Calls",
      "Context tokens": "Context Tokens",
    },
  },
  ko: {
    location: "위치",
    session: "세션",
    date: "날짜",
    item: "항목",
    qty: "수량",
    points: "포인트",
    input: "입력",
    output: "출력",
    reasoning: "추론",
    cached: "캐시",
    cacheWrite: "캐시 쓰기",
    cacheRead: "캐시 읽기",
    subtotal: "소계",
    total: "합계",
    cashier: "담당",
    footerMessage: "연봉 협상 때 이거 언급해.",
    printYourOwn: "Codex 영수증 직접 뽑기:",
    generatedBy: "직접 뽑아보세요",
    breakdowns: {
      "User prompts": "사용자 프롬프트",
      "Assistant replies": "어시스턴트 응답",
      "Tool calls": "도구 호출",
      "Context tokens": "컨텍스트 토큰",
    },
  },
  ja: {
    location: "場所",
    session: "セッション",
    date: "日時",
    item: "項目",
    qty: "数量",
    points: "ポイント",
    input: "入力",
    output: "出力",
    reasoning: "推論",
    cached: "キャッシュ",
    cacheWrite: "キャッシュ書き込み",
    cacheRead: "キャッシュ読み込み",
    subtotal: "小計",
    total: "合計",
    cashier: "担当",
    footerMessage: "今日の仕事、レシートにしました。",
    printYourOwn: "Codex レシートを印刷:",
    generatedBy: "自分でも印刷できます",
    breakdowns: {
      "User prompts": "ユーザープロンプト",
      "Assistant replies": "アシスタント応答",
      "Tool calls": "ツール呼び出し",
      "Context tokens": "コンテキストトークン",
    },
  },
  zh: {
    location: "位置",
    session: "会话",
    date: "日期",
    item: "项目",
    qty: "数量",
    points: "点数",
    input: "输入",
    output: "输出",
    reasoning: "推理",
    cached: "缓存",
    cacheWrite: "缓存写入",
    cacheRead: "缓存读取",
    subtotal: "小计",
    total: "合计",
    cashier: "经手人",
    footerMessage: "今日工作，凭票为证。",
    printYourOwn: "打印你的 Codex 收据:",
    generatedBy: "也来打印一张",
    breakdowns: {
      "User prompts": "用户提示",
      "Assistant replies": "助手回复",
      "Tool calls": "工具调用",
      "Context tokens": "上下文标记",
    },
  },
};

export function normalizeLocale(locale?: string): ReceiptLocale {
  return locale === "ko" || locale === "ja" || locale === "zh" ? locale : "en";
}

export function getReceiptLabels(locale?: string): ReceiptLabels {
  return LABELS[normalizeLocale(locale)];
}
