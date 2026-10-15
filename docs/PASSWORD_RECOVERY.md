# Recover an account password

QuestarrNG does not send password-reset email. A self-hosted operator with
access to the application host or container can reset an account password with
the local CLI. The command updates the same configured SQLite or PostgreSQL
database used by the running application; it does not expose a network reset
endpoint.

## From a source checkout

Run this from the QuestarrNG repository with the same database environment that
the application uses:

```bash
npm run reset-password -- <username>
```

## From a Docker container

Use an interactive terminal and the name of the running QuestarrNG container:

```bash
docker exec -it <container_name> node dist/scripts/reset-password.js <username>
```

The production image ships the compiled CLI at `dist/scripts/reset-password.js`.
The command runs as the container's configured user and uses that container's
database settings and mounted data. Keep the container running; the new password
is available at the next login without a restart.

The CLI asks for the new password twice. On an interactive terminal, input is
hidden. It never accepts a password as a command-line argument, so the secret
does not enter shell history or the process list. If input is piped instead of
entered at a terminal, use a protected input source because terminal masking is
not available in that mode.

The password must be at least eight characters and contain at least one letter
and one number. Leading and trailing whitespace is removed, matching account
setup and password changes. The CLI reports success only after storage confirms
the update; a failed operation exits with a non-zero status and does not log the
password.

Anyone who can execute commands inside the QuestarrNG container already has
administrator-level access to its application data. Restrict host and container
shell access accordingly. See [the security assessment](SECURITY_ASSESSMENT.md)
for the application's broader trust boundaries.
