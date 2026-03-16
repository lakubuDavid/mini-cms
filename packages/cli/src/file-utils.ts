import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname } from "node:path";
import process from "node:process";

export async function readJsonFile<T>(filePath: string, optional = false) {
  try {
    const content = await readFile(filePath, "utf8");
    return JSON.parse(content) as T;
  } catch (error) {
    if (
      optional &&
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return null;
    }

    throw error;
  }
}

export async function writeJson(filePath: string, value: unknown) {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export async function readError(response: Response) {
  try {
    const body = (await response.json()) as { error?: string };
    return body.error ?? `Request failed with status ${response.status}.`;
  } catch {
    return `Request failed with status ${response.status}.`;
  }
}

export function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
}

export function relativeSafe(filePath: string) {
  return filePath.startsWith(`${process.cwd()}/`)
    ? filePath.slice(process.cwd().length + 1)
    : basename(filePath);
}
