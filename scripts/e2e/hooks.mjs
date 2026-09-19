import { existsSync } from "node:fs";
import { dirname, resolve as resolvePath } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const srcRoot = resolvePath(here, "../../src");
const testClient = pathToFileURL(resolvePath(here, "testClient.ts")).href;

function asTsUrl(path) {
  for (const candidate of [`${path}.ts`, `${path}/index.ts`]) {
    if (existsSync(candidate)) return pathToFileURL(candidate).href;
  }
  return null;
}

export async function resolve(specifier, context, nextResolve) {
  const importer = context.parentURL ? fileURLToPath(context.parentURL) : "";
  const inSrc = importer.startsWith(srcRoot);

  // ward.ts asks for the browser client; hand it the test client instead.
  if (inSrc && importer.endsWith("supabase/ward.ts") && specifier === "./client") {
    return { url: testClient, shortCircuit: true };
  }
  if (specifier.startsWith("@/")) {
    const url = asTsUrl(resolvePath(srcRoot, specifier.slice(2)));
    if (url) return { url, shortCircuit: true };
  }
  if (inSrc && specifier.startsWith(".") && !/\.[a-z]+$/.test(specifier)) {
    const url = asTsUrl(resolvePath(dirname(importer), specifier));
    if (url) return { url, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}
