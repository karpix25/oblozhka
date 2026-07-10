import {
  INITIAL_PROGRESS_DOT_FRAME,
  nextProgressDotFrame,
  type ProgressDotFrame
} from "./animatedStatus.js";

export type ProgressMessage = {
  chatId: number;
  messageId: number;
};

export type ProgressRenderer = (frame: ProgressDotFrame) => string;

type ProgressState = {
  active: boolean;
  frame: ProgressDotFrame;
  lastText: string;
  queuedEdit: Promise<void>;
  render: ProgressRenderer;
  timer?: NodeJS.Timeout;
};

export class ProgressAnimator {
  private readonly states = new Map<string, ProgressState>();

  constructor(
    private readonly editMessage: (progress: ProgressMessage, text: string) => Promise<void>,
    private readonly intervalMs = 1200
  ) {}

  start(progress: ProgressMessage, render: ProgressRenderer) {
    const key = progressKey(progress);
    const existing = this.states.get(key);
    if (existing) {
      existing.active = false;
      if (existing.timer) clearInterval(existing.timer);
    }

    const state = this.createState(render);
    state.timer = setInterval(() => {
      state.frame = nextProgressDotFrame(state.frame);
      void this.queueEdit(progress, state);
    }, this.intervalMs);
    state.timer.unref();
    this.states.set(key, state);
  }

  async update(progress: ProgressMessage, render: ProgressRenderer) {
    const state = this.states.get(progressKey(progress));
    if (!state) {
      await this.safeEdit(progress, render(INITIAL_PROGRESS_DOT_FRAME));
      return;
    }

    state.render = render;
    state.frame = INITIAL_PROGRESS_DOT_FRAME;
    await this.queueEdit(progress, state);
  }

  async stop(progress: ProgressMessage) {
    const key = progressKey(progress);
    const state = this.states.get(key);
    if (!state) return;

    state.active = false;
    if (state.timer) clearInterval(state.timer);
    this.states.delete(key);
    await state.queuedEdit;
  }

  private createState(render: ProgressRenderer): ProgressState {
    return {
      active: true,
      frame: INITIAL_PROGRESS_DOT_FRAME,
      lastText: render(INITIAL_PROGRESS_DOT_FRAME),
      queuedEdit: Promise.resolve(),
      render
    };
  }

  private queueEdit(progress: ProgressMessage, state: ProgressState) {
    const key = progressKey(progress);
    state.queuedEdit = state.queuedEdit
      .catch(() => undefined)
      .then(async () => {
        if (!state.active || this.states.get(key) !== state) return;
        const text = state.render(state.frame);
        if (text === state.lastText) return;
        await this.safeEdit(progress, text);
        state.lastText = text;
      });
    return state.queuedEdit;
  }

  private async safeEdit(progress: ProgressMessage, text: string) {
    await this.editMessage(progress, text).catch(() => undefined);
  }
}

function progressKey(progress: ProgressMessage) {
  return `${progress.chatId}:${progress.messageId}`;
}
