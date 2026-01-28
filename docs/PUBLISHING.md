# Publishing to NPM

This guide explains how to publish updates to the NPM registry.

## Prerequisites

- NPM account with publish access to `mcp-server-nyantify`
- Node.js 18+
- Git write access to this repository

## Quick Publish

```bash
# 1. Make sure you're on main branch and everything is committed
git checkout main
git pull origin main

# 2. Run tests (if any)
npm test

# 3. Build the project
npm run build

# 4. Update version (choose one)
npm version patch   # Bug fixes (1.0.0 → 1.0.1)
npm version minor   # New features (1.0.0 → 1.1.0)
npm version major   # Breaking changes (1.0.0 → 2.0.0)

# 5. Publish to NPM
npm publish

# 6. Push git tags
git push origin main --tags
```

## Detailed Workflow

### 1. Pre-publish Checklist

- [ ] All changes committed and pushed
- [ ] Version in `package.json` is correct
- [ ] `CHANGELOG.md` updated (if exists)
- [ ] README.md is up to date
- [ ] Build succeeds without errors: `npm run build`

### 2. Version Selection

Follow [Semantic Versioning](https://semver.org/):

- **PATCH** (1.0.0 → 1.0.1): Bug fixes, documentation updates
- **MINOR** (1.0.0 → 1.1.0): New features, backward compatible
- **MAJOR** (1.0.0 → 2.0.0): Breaking changes, API modifications

### 3. Publishing Steps

```bash
# Login (if not already logged in)
npm login

# Dry run to check what will be published
npm publish --dry-run

# Actually publish
npm publish

# Verify it worked
npm view mcp-server-nyantify versions --json
```

### 4. Post-publish

```bash
# Create GitHub release (optional)
gh release create v1.0.1 --generate-notes

# Announce on social media (optional)
```

## Troubleshooting

### "You do not have permission to publish"

Make sure you're logged in as the correct user:
```bash
npm whoami
npm login
```

### "Version already exists"

You need to bump the version:
```bash
npm version patch
npm publish
```

### Files missing in published package

Check `package.json` `files` field or `.npmignore`:
```bash
npm publish --dry-run
```

## Package Configuration

Key fields in `package.json`:

```json
{
  "name": "mcp-server-nyantify",
  "version": "1.0.0",
  "main": "dist/index.js",
  "bin": {
    "mcp-server-nyantify": "dist/index.js"
  },
  "files": [
    "dist/**/*",
    "README.md",
    "LICENSE"
  ]
}
```

## Automated Publishing (CI/CD)

You can set up GitHub Actions to auto-publish on tag push:

```yaml
# .github/workflows/publish.yml
name: Publish to NPM

on:
  push:
    tags:
      - 'v*'

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          registry-url: 'https://registry.npmjs.org'
      - run: npm ci
      - run: npm run build
      - run: npm publish
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

Add `NPM_TOKEN` to your GitHub repository secrets.
