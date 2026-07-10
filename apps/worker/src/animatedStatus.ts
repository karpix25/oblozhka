export type ProgressDotFrame = 1 | 2 | 3;

export const INITIAL_PROGRESS_DOT_FRAME: ProgressDotFrame = 1;

export function renderAnimatedStatus(label: string, frame: ProgressDotFrame) {
  return `⏳ ${label}${".".repeat(frame)}`;
}

export function nextProgressDotFrame(frame: ProgressDotFrame): ProgressDotFrame {
  return frame === 3 ? 1 : ((frame + 1) as ProgressDotFrame);
}
