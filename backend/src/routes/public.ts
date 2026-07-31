// @ts-nocheck: simplify handlers without explicit typings
import { Hono } from "hono";
import { normalize, relative, resolve } from "std/path";
import { listXMLProfiles } from "../utils/xmlProfiles.ts";
import { resolveInDataRoot } from "../utils/dataPaths.ts";
import {
  contentTypeFromLogoPath,
  resolveLogoFsPathFromPublicPath,
} from "../utils/logoStorage.ts";

const publicRoutes = new Hono();

function isSafeTemplateIdentifier(value: string): boolean {
  return /^[a-z0-9][a-z0-9._-]{0,63}$/i.test(value);
}

publicRoutes.get("/public/assets/logos/:file", async (c) => {
  const file = c.req.param("file") || "";
  const fsPath = resolveLogoFsPathFromPublicPath(
    `/public/assets/logos/${file}`,
  );
  if (!fsPath) return c.notFound();

  try {
    const bytes = await Deno.readFile(fsPath);
    return new Response(bytes, {
      headers: {
        "content-type": contentTypeFromLogoPath(fsPath),
        "cache-control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return c.notFound();
  }
});

// Serve stored template files (fonts, html) for installed templates
publicRoutes.get("/_template-assets/:id/:version/*", async (c) => {
  const { id, version } = c.req.param();
  if (!isSafeTemplateIdentifier(id) || !isSafeTemplateIdentifier(version)) {
    return c.notFound();
  }
  const rest = c.req.param("*") || "";
  const normalizedRest = normalize(rest.replaceAll("\\", "/"));
  if (!normalizedRest || normalizedRest.startsWith("..")) {
    return c.notFound();
  }

  const baseDir = resolveInDataRoot("templates");
  const candidate = resolve(baseDir, id, version, normalizedRest);
  const relativePath = relative(baseDir, candidate);
  if (!relativePath || relativePath.startsWith("..")) {
    return c.notFound();
  }

  try {
    const bytes = await Deno.readFile(candidate);
    return new Response(bytes);
  } catch {
    return c.notFound();
  }
});

// List available built-in XML profiles (public; could also require auth, but contents are non-sensitive)
publicRoutes.get("/public/xml-profiles", (c) => {
  const profiles = listXMLProfiles().map((p) => ({
    id: p.id,
    name: p.name,
    mediaType: p.mediaType,
    fileExtension: p.fileExtension,
    experimental: !!p.experimental,
    builtIn: true,
  }));
  return c.json(profiles);
});

export { publicRoutes };
