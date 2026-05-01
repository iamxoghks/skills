export interface ParsedTranscript {
  sessionSlug: string;
  firstPrompt: string;
  startTime: Date;
  endTime: Date;
  userMessageCount: number;
  assistantMessageCount: number;
  totalMessages: number;
}
