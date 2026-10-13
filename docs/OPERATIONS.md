# Operational Procedures

This document outlines the standard operating procedures for maintaining and hardening this repository.

## Running and monitoring an installation

For a standard installation, follow the Docker Compose steps in the
[README](../README.md). The bundled Compose file persists application state in
the host's `./data` directory, including the SQLite database and
`config.yaml`; the Postgres Compose file still needs that mount for non-database
state. Both configurations run database migrations when the app starts, so a
normal restart does not need a separate schema-push command.

Check the app container and its recent logs with:

```bash
docker compose ps
docker compose logs --tail=100 app
```

The Compose health check calls `GET /api/health`. That is a liveness check: it
confirms the server responds. `GET /api/ready` also checks the database and
IGDB connectivity and returns `503` if either is unavailable. Use your mapped
port if it differs from the default `5000`:

```bash
curl --fail http://localhost:5000/api/health
curl --fail http://localhost:5000/api/ready
```

## Backups and recovery

Take a backup before applying an update, and keep the image version, Compose
file, and required environment settings with it. Protect backups as secrets:
they can contain account data, integration configuration, and database
credentials. Do not commit or attach them to public issues.

With the default SQLite Compose setup, stop the app before copying `./data` so
the database and any SQLite write-ahead log files are captured consistently:

```bash
docker compose stop app
tar -czf ../questarr-data-$(date +%F).tar.gz data
docker compose start app
```

With the bundled Postgres Compose setup, create a database dump and back up
`./data` separately because it still contains configuration and other
non-database state:

```bash
docker compose -f docker-compose.postgres.yml exec -T db \
  pg_dump -U questarr -d questarr > ../questarr-db-$(date +%F).sql
tar -czf ../questarr-data-$(date +%F).tar.gz data
```

If Postgres is hosted outside Compose, use the database provider's backup
procedure. Store `.env` and any database passwords in a protected backup
location; do not place secrets in the SQL dump or a public repository.

To recover, stop the app, restore the data directory and the matching database
backup, then start the same app version that created the backup and check both
health endpoints. Restore a Postgres dump into a clean database rather than
over an active Questarr database. Test the recovery procedure periodically;
keeping a backup is useful only if it can be restored.

## Verification Matrix

All pull requests and hardening passes must pass the following verification gates:

| Gate           | Command                | Requirement                                         |
| -------------- | ---------------------- | --------------------------------------------------- |
| **Build**      | `npm run build`        | Must compile without errors.                        |
| **Lint**       | `npm run lint`         | Must pass without warnings or errors.               |
| **Format**     | `npm run format:check` | Code must be formatted according to Prettier rules. |
| **Unit Tests** | `npm run test:run`     | All unit tests must pass.                           |
| **Type Check** | `npm run check`        | TypeScript compiler must pass without errors.       |

## Auto-fix & Improvement Policy

### Allowed Automatic Fixes

- Lint & formatting fixes (`prettier`, `eslint --fix`).
- Test repairs (fixing selectors, assertions, mocks).
- Small product bugfixes where tests prove a regression.
- Small, measurable UX and performance micro-optimizations.
- Adding or tightening smoke tests and improving build scripts.

### Disallowed

- Large refactors, schema/API changes.
- Adding new external services or dependencies without approval.
- Committing secrets.
- Removing tests or masking failures.

## Hardening Workflow

1.  **Inventory & Diagnose**: Check current state, run verification matrix.
2.  **Iterative Remediation**: Fix failures using the allowed policy.
3.  **Proactive Improvement**: Implement small, high-impact improvements.
4.  **Deliver Green PR**: Submit fully-tested changes.

## Windows release assets

Windows installers use the existing manual **Deploy Web App** workflow. Creating
a tag creates a draft release; it does not build or attach an installer.

Before publishing a release that advertises Windows support:

1. Wait for the matching draft GitHub release to exist.
2. Run **Deploy Web App** from the release commit with the matching `tag` input
   (for example, `v1.5.0`) and **build_windows_installer** enabled. Choose the
   deployment environment intended for that release.
3. Verify that `QuestarrSetup-<version>-windows-x64.exe` and its `.sha256` file
   are attached to the matching release. The version comes from `package.json`
   on the workflow's selected ref, so it must match the release.
4. Publish the release only after verifying its assets.

The installer job treats a missing matching release as a skipped attachment.
If that occurs, attach the executable and checksum from the workflow artifact
to the matching draft release before publishing. Tagging, dispatching the
deployment workflow, and publication remain maintainer actions.
