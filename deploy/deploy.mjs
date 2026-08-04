import { appendFileSync } from "node:fs";

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

const buildConfig = {
  builder: process.env.SERVER,
  git_provider: process.env.GIT_PROVIDER || "github.com",
  repo: process.env.REPO,
  branch: process.env.BRANCH,
  build_path: process.env.BUILD_PATH,
  dockerfile_path: process.env.DOCKERFILE_PATH,
  image_name: process.env.IMAGE_NAME,
  include_commit_tag: true,
  include_latest_tag: false,
  include_version_tags: false,
  webhook_enabled: false,
};

let buildExists = true;
try {
  await komodo.read("GetBuild", { build: process.env.BUILD_NAME });
} catch {
  buildExists = false;
}

if (buildExists) {
  await komodo.write("UpdateBuild", { id: process.env.BUILD_NAME, config: buildConfig });
} else {
  await komodo.write("CreateBuild", { name: process.env.BUILD_NAME, config: buildConfig });
}

const buildUpdate = await komodo.execute_and_poll("RunBuild", { build: process.env.BUILD_NAME });
if (!buildUpdate.success) {
  throw new Error(`Build failed for ${process.env.BRANCH} - see Build logs in Komodo.`);
}

const imageTag = buildUpdate.commit_hash || process.env.COMMIT_SHA || "latest";
const environment = `IMAGE_TAG=${imageTag}\n${process.env.ENVIRONMENT}`;

const stackConfig = {
  server: process.env.SERVER,
  repo: process.env.REPO,
  branch: process.env.BRANCH,
  git_provider: process.env.GIT_PROVIDER || "github.com",
  file_paths: process.env.COMPOSE_FILE_PATHS.split(","),
  auto_pull: false,
  destroy_before_deploy: false,
  webhook_enabled: false,
  environment,
};

let stackExists = true;
try {
  await komodo.read("GetStack", { stack: process.env.STACK_NAME });
} catch {
  stackExists = false;
}

if (stackExists) {
  await komodo.write("UpdateStack", { id: process.env.STACK_NAME, config: stackConfig });
} else {
  await komodo.write("CreateStack", { name: process.env.STACK_NAME, config: stackConfig });
}

const deployUpdate = await komodo.execute_and_poll("DeployStack", { stack: process.env.STACK_NAME });
if (!deployUpdate.success) {
  throw new Error(`Deploy failed for ${process.env.STACK_NAME} - see Stack logs in Komodo.`);
}

console.log(`Deployed ${process.env.STACK_NAME} from ${process.env.BRANCH}`);
appendFileSync(process.env.GITHUB_OUTPUT, `commit-hash=${buildUpdate.commit_hash ?? ""}\n`);
