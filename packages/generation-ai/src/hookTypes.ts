export type HookCandidate = {
  text: string;
  angle?: string;
  evidence?: string;
  score?: number;
};

export type HookContext = {
  transcript: string;
  theme?: string;
  keywords: string[];
  numbers: string[];
};
