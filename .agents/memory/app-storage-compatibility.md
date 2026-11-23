---
name: App Storage SDK compatibility
description: Why storage SDK upgrades need real sidecar-backed upload and deletion checks.
---

Keep the Google Cloud Storage SDK compatible with Replit's sidecar credentials, without requiring Google Cloud project-ID discovery for access to an explicitly named bucket.

**Why:** The SDK's major-version 9 transport attempted project-ID discovery and failed despite a provisioned default bucket and valid managed storage configuration. The compatible major-version 7 transport successfully uploaded, served and deleted real objects using the unchanged sidecar client setup.

**How to apply:** Before upgrading the storage SDK across major versions, verify real upload/read/delete operations through the app with Replit-managed credentials. Do not work around project-ID discovery failures by inventing a project ID, requesting unrelated cloud credentials, or switching uploads to local disk.
