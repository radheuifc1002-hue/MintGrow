# Vercel deployment trigger

This file intentionally triggers a fresh deployment from the latest `main` commit.

The `expo-markdown-display` dependency fix is already present in `package.json` on this branch. This update forces Vercel to build the current `main` commit instead of relying on an older deployment snapshot.

No application behavior is changed by this file.
