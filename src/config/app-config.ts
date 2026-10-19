export const WORKER_URL =
  (import.meta.env.VITE_WORKER_URL as string | undefined)?.replace(/\/$/, "") ?? "";

const DEV_OWNER_ID = "3575344";

export const isDevOwner = (ownerId: unknown): boolean => String(ownerId ?? "") === DEV_OWNER_ID;
