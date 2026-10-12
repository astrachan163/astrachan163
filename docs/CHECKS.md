# Checks

This repository is a profile page. It has no install step, build, linter, or unit suite. Run these from the repository root:

```sh
node scripts/check-claims.mjs
node scripts/check-emoji.mjs
node scripts/check-banned-mark.mjs
gitleaks dir . --redact
```

## Security

No secrets are committed. Report a problem to strachan@uab.edu.
