# Contributing

Thanks for helping out. This repo is small on purpose: two composite actions, one dependency, no build step.

## Layout

<img src="docs/img/file-structure.svg" alt="Repository layout: deploy and ensure-action directories each hold an action.yml and a Node script, while package.json and package-lock.json sit at the repository root and are shared by both." width="850">

Each action is a top-level directory, because that is what lets a caller write
`BrockCSC/komodo-deploy/<dir>@<ref>`. Everything else is shared.

## How the actions are wired

Both `action.yml` files are composite actions doing the same two things:

1. `npm ci --prefix "${{ github.action_path }}/.."` — note the `/..`. Dependencies install at the **repository
   root**, not inside the action directory. A `package.json` placed under `deploy/` or `ensure-action/` would be
   ignored.
2. `node "${{ github.action_path }}/<script>.mjs"`, with every input passed through as an environment variable.

So an input is declared in three places: the `inputs:` block, the `env:` block that maps it to a variable, and the
script that reads `process.env`. Adding one means touching all three.

## Shape of the scripts

Both `.mjs` files open with the same shim:

```js
globalThis.localStorage ??= new Map();
globalThis.localStorage.getItem ??= (k) => globalThis.localStorage.get(k) ?? null;
globalThis.localStorage.setItem ??= (k, v) => globalThis.localStorage.set(k, String(v));

const { KomodoClient } = await import("komodo_client");
```

`komodo_client` pulls in a browser-oriented auth helper that touches `globalThis.localStorage` when it is imported,
which plain Node doesn't provide. Keep the shim above the **dynamic** import — a static `import` would be hoisted and
run first, and throw.

## The upsert pattern

Every resource follows the same shape, and new ones should too:

```js
let exists = true;
try {
  await komodo.read("GetThing", { thing: name });
} catch {
  exists = false;
}

if (exists) {
  await komodo.write("UpdateThing", { id: name, config });
} else {
  await komodo.write("CreateThing", { name, config });
}
```

This is what makes the actions self-healing: a fresh Komodo instance and a long-running one take the same path, and
config drift made in the UI is corrected on the next deploy.

Anything that executes goes through `execute_and_poll`, and a failed update must print its logs before throwing:

```js
if (!update.success) {
  for (const log of update.logs ?? []) {
    console.log(`::group::${log.stage}: ${log.command}`);
    if (log.stdout) console.log(log.stdout);
    if (log.stderr) console.error(log.stderr);
    console.log("::endgroup::");
  }
  throw new Error("… - see logs above.");
}
```

A failure that only says "check the Komodo UI" is not a useful failure.

## Testing a change

There is no test runner and nothing is compiled — what is committed is what runs. That means the only real test is a
workflow run:

1. Push your branch.
2. In a consuming repo, point the step at it: `uses: BrockCSC/komodo-deploy/deploy@your-branch`.
3. Watch the run, and check the resource in Komodo afterwards.

Use a throwaway `build-name` and `stack-name` while you do this so you don't reconfigure a live deployment. Because
the actions upsert, pointing them at an existing resource **will** rewrite its config.

## Adding an action

A new top-level directory with an `action.yml` and a script, plus a section in the README. Do not add a second
`package.json`; add the dependency to the root one and commit the updated `package-lock.json`, since `npm ci`
requires it.

## Releasing

Consumers pin a major tag such as `@v1`, so:

- A backwards-compatible change can move the existing major tag.
- Renaming or removing an input, or changing a default, needs a new major tag. Don't force-push a breaking change
  onto a tag people are already using.

## Docs

The diagrams in `docs/img/` are hand-written SVG, committed as files and referenced with `<img>` — GitHub strips
inline `<svg>` out of Markdown, so they cannot be embedded directly. They are also served under a strict CSP with
no scripts, no external images and no web fonts, so keep them self-contained and stick to system font stacks.

They use one flat palette that stays legible on both the light and dark GitHub themes rather than shipping a pair
per theme, because an SVG's `prefers-color-scheme` follows the operating system and not GitHub's own theme setting;
the two disagree often enough that a theme-switched diagram is unreadable for those users.

Any animation is CSS `@keyframes`, never SMIL, so that it can be turned off — every animated file carries a
`prefers-reduced-motion: reduce` rule and is drawn to read correctly when completely still.

If you change what an action does, update the diagram in the same pull request. A wrong picture is worse than none.
