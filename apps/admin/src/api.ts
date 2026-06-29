import type { CreditPackage, Generation, Payment, PromptPreset, User } from "./types.js";

const apiUrl = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:3000";

function token() {
  return localStorage.getItem("adminToken") ?? import.meta.env.VITE_ADMIN_TOKEN ?? "";
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${apiUrl}/admin${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token()}`,
      ...init.headers
    }
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json() as Promise<T>;
}

export function saveToken(value: string) {
  localStorage.setItem("adminToken", value);
}

export const adminApi = {
  users: () => request<User[]>("/users"),
  packages: () => request<CreditPackage[]>("/packages"),
  payments: () => request<Payment[]>("/payments"),
  generations: () => request<Generation[]>("/generations"),
  presets: () => request<PromptPreset[]>("/presets"),
  adjustCredits: (userId: string, amount: number, note: string) =>
    request(`/users/${userId}/credits`, {
      method: "POST",
      body: JSON.stringify({ amount, note })
    }),
  createPackage: (input: Pick<CreditPackage, "title" | "starsPrice" | "credits">) =>
    request<CreditPackage>("/packages", {
      method: "POST",
      body: JSON.stringify(input)
    }),
  updatePackage: (id: string, input: Partial<CreditPackage>) =>
    request<CreditPackage>(`/packages/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input)
    }),
  createPreset: (input: Omit<PromptPreset, "id" | "isActive">) =>
    request<PromptPreset>("/presets", {
      method: "POST",
      body: JSON.stringify(input)
    }),
  updatePreset: (id: string, input: Partial<PromptPreset>) =>
    request<PromptPreset>(`/presets/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input)
    })
};
