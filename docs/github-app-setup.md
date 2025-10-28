# GitHub App setup

The coding assessment workflow provisions seed and candidate repositories by
calling the GitHub App installation APIs. Follow the steps below to create the
app, capture its credentials, and wire it into the Afterquery backend.

## 1. Create the GitHub App

1. Sign in to GitHub with the owner account for the organization that will host
   the mirrored seed repositories (e.g. `github.com/your-company`).
2. Navigate to **Settings → Developer settings → GitHub Apps** and click
   **New GitHub App**.
3. Use a descriptive name such as `Afterquery Assessment Helper` and provide a
   homepage URL for your product (the URL is informational only).
4. Leave the **Webhook** section disabled for now. The backend polls for status
   and does not require inbound webhooks yet.
5. Under **Repository permissions** grant the following scopes:
   - **Administration** – Read & write (needed to create repos and configure
     templates).
   - **Contents** – Read & write (needed to import code and push branch
     protections).
   - **Metadata** – Read.
   - **Pull requests** – Read & write (reserved for review comments).
6. Leave **Organization permissions** at their defaults unless you plan to use
   org-level endpoints later.
7. Enable the **Repository** event subscription so the app can receive future
   webhooks if required.
8. Save the app and **Generate a private key**. Download the PEM file – you will
   reference it in the environment variables below.

## 2. Install the app on your organization

1. From the GitHub App settings page click **Install App** and choose the target
   organization.
2. Select **All repositories**. The backend manages the visibility of new seed
   and candidate repositories and expects access to create them on-demand.
3. After installation note the URL – the numeric segment at the end is the
   `installation_id` required by the API (for example `/installations/12345678`).

## 3. Configure environment variables

Populate the following variables in the FastAPI backend environment (or your
local `.env` file):

```bash
GITHUB_APP_ID=123456
# Paste the PEM contents or a base64/\n escaped version – the backend normalises the value.
GITHUB_APP_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GITHUB_APP_INSTALLATION_ID=12345678
GITHUB_ORG=your-company
# Optional overrides
# GITHUB_API_BASE_URL=https://api.github.com
# GITHUB_SEED_PREFIX=afterquery-seed
# GITHUB_CANDIDATE_PREFIX=afterquery-candidate
```

Install the backend dependencies to ensure the GitHub App helper can mint
RS256-signed tokens:

```bash
pip install -r backend/requirements.txt
```

Commit the variables to your deployment platform’s secret store. The new
`backend/app/github_app.py` helper consumes these settings and caches the
installation token automatically.

## 4. Verify access

Before inviting candidates run a quick smoke test:

```bash
# Uses the cached JWT + installation token to list repositories the app can access
uvicorn backend.app.main:app --reload
curl -H "Authorization: Bearer <SUPABASE_SERVICE_TOKEN>" \
  "http://localhost:8000/api/seeds" # create a seed from the UI afterwards
```

You can also hit the GitHub API directly using the app credentials:

```bash
python - <<'PY'
from backend.app.github_app import get_github_app_client
import asyncio

async def main():
    client = get_github_app_client()
    token, expires = await client._create_installation_access_token()  # noqa: SLF001
    print("Token expires at", expires)

asyncio.run(main())
PY
```

The helper should mint a token valid for approximately one hour. Seeds and
candidate repositories are created inside `GITHUB_ORG` using the configurable
prefixes, and the backend automatically marks the seed repository as a private
template with the `main` default branch.

## 5. Optional: branch protection & webhooks

If you would like to enforce branch protection or react to repository events,
you can extend the GitHub App permissions and configure the webhook URL to
point at a FastAPI endpoint (e.g. `/api/github/webhook`). The current
implementation does not require incoming events, but the GitHub App can be
augmented without any schema changes.
