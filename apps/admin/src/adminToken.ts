const ADMIN_TOKEN_STORAGE_KEY = "adminToken";

type TokenStorage = Pick<Storage, "getItem" | "setItem">;

export function readAdminToken(storage: Pick<Storage, "getItem"> = localStorage) {
  return storage.getItem(ADMIN_TOKEN_STORAGE_KEY) ?? "";
}

export function saveToken(value: string, storage: TokenStorage = localStorage) {
  storage.setItem(ADMIN_TOKEN_STORAGE_KEY, value);
}
