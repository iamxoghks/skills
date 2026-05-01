export type ReceiptLocale = "en" | "ko";

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
};

export function normalizeLocale(locale?: string): ReceiptLocale {
  return locale === "ko" ? "ko" : "en";
}

export function getReceiptLabels(locale?: string): ReceiptLabels {
  return LABELS[normalizeLocale(locale)];
}
