# Maintainers

QuestarrNG is maintained in the `snapetech/QuestarrNG` repository. This page
records who holds elevated repository access and the responsibilities attached
to the maintainer role. GitHub settings remain the source of truth for current
permissions; review this page whenever collaborator or team access changes.

## Roles and responsibilities

### Repository owner and maintainer

As checked on October 13, 2026, `@snapetech` is the repository owner and the
only direct collaborator with administrator access. The owner is responsible
for:

- setting project direction and approving technical changes;
- reviewing and merging pull requests, including maintaining branch-protection
  rules and required checks;
- managing releases, release artifacts, and publishing workflows;
- triaging reported vulnerabilities and coordinating security fixes;
- reviewing collaborator access requests under the
  [Collaborator Access & Escalation Policy](SECURITY.md#collaborator-access--escalation-policy);
- enforcing the [Code of Conduct](CODE_OF_CONDUCT.md).

No other formal maintainer or reviewer roles were listed in the repository's
direct collaborators or team access at that review.

## Sensitive access

The direct collaborator and repository-team list was checked in GitHub on
October 13, 2026. It contained the following account:

| Account      | GitHub role                        | Sensitive access                                                                                                 |
| ------------ | ---------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `@snapetech` | Repository owner and administrator | Can manage repository settings, Actions secrets and environments, release workflows, and deployment permissions. |

No other direct collaborators or repository teams had access at that check.
Hosting providers, production systems, and external secret stores can have
separate access controls that are not visible in the GitHub collaborator list.
Record those accounts here when access is granted, and verify them in the
relevant provider's settings; do not infer that this table covers external
infrastructure.

The fork's release workflows publish images to GitHub Container Registry with
the repository-scoped `GITHUB_TOKEN`. Docker Hub publishing has been removed.
Tag releases include validated `release-notes/` fragments in the GitHub release
and Discord announcement. Configure the Actions secret
`DISCORD_RELEASE_WEBHOOK` with the release-announcement channel webhook.
Repository administrators manage Actions permissions and release access in
GitHub settings, following the [Collaborator Access & Escalation Policy](SECURITY.md#collaborator-access--escalation-policy).

QuestarrNG is derived from Doezer's Questarr project. Copyright and contributor
attribution for that upstream work remains in the source and license files.
