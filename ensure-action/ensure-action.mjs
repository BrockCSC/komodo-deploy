import { readFileSync } from "node:fs";
import { join } from "node:path";

// komodo_client pulls in a browser-oriented auth helper that touches
// globalThis.localStorage at import time, which plain Node doesn't provide.
globalThis.localStorage ??= new Map();
globalThis.localStorage.getItem ??= (k) => globalThis.localStorage.get(k) ?? null;
globalThis.localStorage.setItem ??= (k, v) => globalThis.localStorage.set(k, String(v));

const { KomodoClient } = await import("komodo_client");

const komodo = KomodoClient(process.env.KOMODO_HOST, {
  type: "api-key",
  params: { key: process.env.KOMODO_API_KEY, secret: process.env.KOMODO_API_SECRET },
});

const fileContents = readFileSync(
  join(process.env.GITHUB_WORKSPACE, process.env.SCRIPT_PATH),
  "utf8",
);

const config = {
  webhook_enabled: false,
  file_contents: fileContents,
  schedule: process.env.SCHEDULE || "",
  schedule_format: process.env.SCHEDULE_FORMAT || "English",
  schedule_enabled: process.env.SCHEDULE_ENABLED === "true",
};

let exists = true;
try {
  await komodo.read("GetAction", { action: process.env.ACTION_NAME });
} catch {
  exists = false;
}

if (exists) {
  await komodo.write("UpdateAction", { id: process.env.ACTION_NAME, config });
} else {
  await komodo.write("CreateAction", { name: process.env.ACTION_NAME, config });
}

console.log(`Ensured Action ${process.env.ACTION_NAME}`);
