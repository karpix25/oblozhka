export type HookCandidate = {
  text: string;
  angle?: string;
  score?: number;
};

export type HookContext = {
  transcript: string;
  theme?: string;
  keywords: string[];
  numbers: string[];
};
