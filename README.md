# komodo-deploy

Reusable GitHub Actions for deploying apps to a self-hosted [Komodo](https://komo.do) instance. Both actions use the
official [`komodo_client`](https://www.npmjs.com/package/komodo_client) npm package and are self-healing: they create
the Komodo resources they need on first run, so nothing has to be pre-configured by hand in the Komodo UI.

## `deploy`

Ensures a Komodo `Build` and `Stack` exist, builds the given branch, and deploys the resulting image.

```yaml
- id: deploy-context
  run: node komodo/deploy-context.mjs
  env:
    REF: ${{ github.ref }}
    SHA: ${{ github.sha }}

- uses: BrockCSC/komodo-deploy/deploy@v1
  with:
    komodo-host: ${{ vars.KOMODO_HOST }}
    komodo-api-key: ${{ secrets.KOMODO_API_KEY }}
    komodo-api-secret: ${{ secrets.KOMODO_API_SECRET }}
    build-name: brockcsc
    server: wayfarerbx-vps
    repo: BrockCSC/website
    build-path: .
    dockerfile-path: Dockerfile
    image-name: brockcsc-ca
    branch: ${{ steps.deploy-context.outputs.branch }}
    stack-name: ${{ steps.deploy-context.outputs.stack-name }}
    compose-file-paths: deploy/docker-compose.yml
    environment: ${{ steps.deploy-context.outputs.environment }}
```

### Inputs

| name                  | required | description                                                        |
| --------------------- | -------- | -------------------------------------------------------------------- |
| `komodo-host`         | yes      | Komodo API base URL                                                  |
| `komodo-api-key`      | yes      |                                                                        |
| `komodo-api-secret`   | yes      |                                                                        |
| `build-name`          | yes      | Komodo Build resource name (created if missing)                      |
| `server`              | yes      | Komodo Server name, used as both the Build's builder and Stack server |
| `repo`                | yes      | `owner/name`                                                          |
| `build-path`          | yes      |                                                                        |
| `dockerfile-path`     | yes      |                                                                        |
| `image-name`          | yes      |                                                                        |
| `branch`              | yes      | Branch (or tag name) to build and deploy from                        |
| `stack-name`          | yes      | Komodo Stack resource name (created if missing)                      |
| `compose-file-paths`  | yes      | Comma-separated, e.g. `deploy/docker-compose.yml`                    |
| `environment`         | yes      | Multiline `KEY=VALUE` block for the Stack's environment              |
| `git-provider`        | no       | Default `github.com`                                                 |

### Outputs

| name          | description                             |
| ------------- | ---------------------------------------- |
| `commit-hash` | Commit hash tagged on the built image    |

## `ensure-action`

Registers or updates a Komodo `Action` resource from a local script file, for logic that needs to run inside Komodo
(e.g. network access to a private docker network CI runners can't reach).

```yaml
- uses: BrockCSC/komodo-deploy/ensure-action@v1
  with:
    komodo-host: ${{ vars.KOMODO_HOST }}
    komodo-api-key: ${{ secrets.KOMODO_API_KEY }}
    komodo-api-secret: ${{ secrets.KOMODO_API_SECRET }}
    action-name: brockcsc-preview-sweep
    script-path: komodo/actions/preview-sweep.ts
    schedule: "at 09:00 am"
    schedule-enabled: true
```

### Inputs

| name                | required | description                                                    |
| ------------------- | -------- | ---------------------------------------------------------------- |
| `komodo-host`       | yes      |                                                                    |
| `komodo-api-key`    | yes      |                                                                    |
| `komodo-api-secret` | yes      |                                                                    |
| `action-name`       | yes      | Komodo Action resource name (created if missing)                 |
| `script-path`       | yes      | Path, in the caller's checkout, to the `.ts` file to upload       |
| `schedule`          | no       | Komodo schedule string, e.g. `at 09:00 am`                       |
| `schedule-format`   | no       | Default `English`                                                 |
| `schedule-enabled`  | no       | Default `false`                                                   |
