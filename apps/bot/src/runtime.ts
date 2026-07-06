import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import type { Bot } from "grammy";
import { webhookCallback } from "grammy";
import type { BotContext } from "./session.js";

const DEFAULT_WEBHOOK_HOST = "0.0.0.0";
const DEFAULT_WEBHOOK_PORT = 8080;

export type BotRuntimeConfig =
  | { mode: "polling" }
  | {
      mode: "webhook";
      webhookUrl: string;
      host: string;
      port: number;
    };

export type BotRuntime = {
  config: BotRuntimeConfig;
  stop: () => Promise<void>;
};

export type BotRuntimeOptions = {
  env?: NodeJS.ProcessEnv;
  onShutdown?: () => Promise<void>;
};

export function parseBotRuntimeConfig(env: NodeJS.ProcessEnv = process.env): BotRuntimeConfig {
  const webhookUrl = trimmed(env.BOT_WEBHOOK_URL);
  if (!webhookUrl) {
    return { mode: "polling" };
  }

  validateWebhookUrl(webhookUrl);

  return {
    mode: "webhook",
    webhookUrl,
    host: trimmed(env.BOT_WEBHOOK_HOST) ?? DEFAULT_WEBHOOK_HOST,
    port: parsePort(trimmed(env.BOT_WEBHOOK_PORT) ?? String(DEFAULT_WEBHOOK_PORT), "BOT_WEBHOOK_PORT")
  };
}

export async function startBotRuntime(
  bot: Bot<BotContext>,
  options: BotRuntimeOptions = {}
): Promise<BotRuntime> {
  const config = parseBotRuntimeConfig(options.env);
  const runtime = config.mode === "webhook"
    ? await startWebhookRuntime(bot, config)
    : await startPollingRuntime(bot);
  const stop = once(async () => {
    await runtime.stop();
    await options.onShutdown?.();
  });

  installSignalHandlers(stop);
  return { config, stop };
}

function startPollingRuntime(bot: Bot<BotContext>): Promise<BotRuntime> {
  return bot.api.deleteWebhook().then(() => {
    const polling = bot.start({
      onStart: (botInfo) => {
        console.log(`Bot @${botInfo.username} started in long polling mode.`);
      }
    });

    polling.catch((error) => {
      console.error("Bot polling failed.", error);
      process.exitCode = 1;
    });

    return {
      config: { mode: "polling" },
      stop: async () => {
        if (bot.isRunning()) {
          await bot.stop();
        }
        await polling.catch(() => undefined);
      }
    };
  });
}

async function startWebhookRuntime(
  bot: Bot<BotContext>,
  config: Extract<BotRuntimeConfig, { mode: "webhook" }>
): Promise<BotRuntime> {
  await bot.api.setWebhook(config.webhookUrl);

  const server = createServer(webhookCallback(bot, "http"));
  await listen(server, config.port, config.host);
  const address = server.address() as AddressInfo;
  console.log(
    `Bot webhook listener started on ${address.address}:${address.port}; Telegram webhook is ${config.webhookUrl}.`
  );

  return {
    config,
    stop: () => closeServer(server)
  };
}

function installSignalHandlers(stop: () => Promise<void>) {
  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.once(signal, () => {
      stop()
        .then(() => process.exit(0))
        .catch((error) => {
          console.error(`Bot shutdown failed after ${signal}.`, error);
          process.exit(1);
        });
    });
  }
}

function listen(server: Server, port: number, host: string) {
  return new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => {
      server.off("error", reject);
      resolve();
    });
  });
}

function closeServer(server: Server) {
  return new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

function validateWebhookUrl(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("BOT_WEBHOOK_URL must be a valid absolute URL.");
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("BOT_WEBHOOK_URL must use http or https.");
  }
}

function parsePort(value: string, name: string) {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`${name} must be an integer from 1 to 65535.`);
  }
  return port;
}

function trimmed(value: string | undefined) {
  const next = value?.trim();
  return next ? next : undefined;
}

function once(callback: () => Promise<void>) {
  let promise: Promise<void> | undefined;
  return () => {
    promise ??= callback();
    return promise;
  };
}
