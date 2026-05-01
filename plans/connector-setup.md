# Connector setup — Microsoft 365 + Google Workspace

This is the runbook for the Custodia platform owner. Until these env vars
are set in Vercel, the connector "Connect" buttons will return a friendly
`connector_not_configured` JSON response listing exactly what's missing —
nothing is broken, just dormant.

You only have to do each provider **once** for the whole platform. Every
customer reuses the same App Registration / OAuth Client.

---

## Microsoft 365 (Azure AD App Registration)

**Where:** [https://portal.azure.com](https://portal.azure.com) → Microsoft Entra ID → App registrations → **+ New registration**

### Step 1 — Register the app

- **Name:** `Custodia Compliance Connector`
- **Supported account types:** *Accounts in any organizational directory (Multitenant)*
- **Redirect URI:**
  - Platform: **Web**
  - URI: `https://<YOUR_DOMAIN>/api/connectors/m365/callback`
    (use `https://custodia.us/api/connectors/m365/callback` once domain is wired; for local dev add a second redirect `http://localhost:3000/api/connectors/m365/callback`)

Click **Register**.

### Step 2 — Capture identifiers

On the app's **Overview** page, copy:

- **Application (client) ID** → `MICROSOFT_CLIENT_ID`
- **Directory (tenant) ID** → `MICROSOFT_TENANT_ID`

> For multi-tenant production use, you can keep `MICROSOFT_TENANT_ID=common`
> in your env so any customer's tenant can consent. We pin to a tenant only
> for single-tenant deployments.

### Step 3 — Create a client secret

Left nav → **Certificates & secrets** → **Client secrets** → **+ New client secret**

- Description: `custodia-prod`
- Expires: 24 months (set a calendar reminder to rotate)
- Click **Add**, then **immediately copy the Value** (not the Secret ID)

→ `MICROSOFT_CLIENT_SECRET`

### Step 4 — Add API permissions

Left nav → **API permissions** → **+ Add a permission** → **Microsoft Graph** → **Delegated permissions** (we use delegated, not application).

Check these scopes:

- `User.Read.All`
- `AuditLog.Read.All`
- `Policy.Read.All`
- `Reports.Read.All`
- `offline_access` (for refresh tokens)

Click **Add permissions**, then **✓ Grant admin consent for <tenant>**.

### Step 5 — Set Vercel env vars

In Vercel project settings → **Environment Variables**, add for **Production**, **Preview**, and **Development**:

```
MICROSOFT_CLIENT_ID=<step 2>
MICROSOFT_CLIENT_SECRET=<step 3>
MICROSOFT_TENANT_ID=<step 2 — or "common" for multi-tenant>
```

Redeploy.

---

## Google Workspace (Google Cloud OAuth Client)

**Where:** [https://console.cloud.google.com](https://console.cloud.google.com)

### Step 1 — Create / select a project

Top bar → project picker → **NEW PROJECT** → `custodia-platform`.

### Step 2 — Enable required APIs

Left nav → **APIs & Services** → **Library**. Enable:

- **Admin SDK API**
- **Google Workspace Reports API**
- **Google Workspace Audit API** (if available; if not, the Reports API covers our needs)

### Step 3 — Configure OAuth consent screen

Left nav → **APIs & Services** → **OAuth consent screen**.

- **User Type:** *External* (for multi-tenant). Use *Internal* only if Custodia itself is a Google Workspace tenant and you only want internal admins.
- **App name:** `Custodia Compliance`
- **User support email:** `officers@custodia.us`
- **Authorized domains:** `custodia.us`
- **Developer contact:** `officers@custodia.us`

### Step 4 — Add scopes

In the consent-screen wizard, **+ Add or remove scopes** → search and add:

- `https://www.googleapis.com/auth/admin.directory.user.readonly`
- `https://www.googleapis.com/auth/admin.reports.audit.readonly`
- `https://www.googleapis.com/auth/admin.directory.domain.readonly`

These are **restricted scopes** — Google requires verification before the
app can be used by orgs other than your own. Submit for verification once
you have a privacy policy and homepage URL ready (`/privacy` route is a TODO).

### Step 5 — Create the OAuth Client ID

Left nav → **APIs & Services** → **Credentials** → **+ Create credentials** → **OAuth client ID**.

- **Application type:** *Web application*
- **Name:** `custodia-web`
- **Authorized JavaScript origins:** `https://custodia.us`, `http://localhost:3000`
- **Authorized redirect URIs:**
  - `https://<YOUR_DOMAIN>/api/connectors/google/callback`
  - `http://localhost:3000/api/connectors/google/callback`

Click **Create** → copy the **Client ID** and **Client secret**.

### Step 6 — Set Vercel env vars

```
GOOGLE_CLIENT_ID=<step 5>
GOOGLE_CLIENT_SECRET=<step 5>
```

Redeploy.

---

## Connector token encryption key (recommended)

Custodia encrypts all connector tokens at rest with AES-256-GCM. The key
source priority is:

1. `CONNECTOR_TOKEN_KEY` — preferred (32-byte key, hex-encoded)
2. Derived from `ATTESTATION_SIGNING_KEY` via HKDF-SHA256 — fallback;
   prints a warning in production logs

Generate a key:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Set in Vercel:

```
CONNECTOR_TOKEN_KEY=<64 hex chars>
```

Rotation: setting a new value will make existing connector rows
undecryptable. Connected customers will be re-prompted to re-auth on
their next connector use. Plan rotations during low-traffic windows.

---

## Verification

Once env vars are set, hit (signed in as a customer):

```
GET /api/connectors/m365/start
GET /api/connectors/google/start
```

If env is set, it redirects to the IdP. If not, it returns a JSON
response with `error: "connector_not_configured"` and lists the missing
env vars — no 500s.

After OAuth completes, check:

```sql
SELECT organization_id, provider, connected_at, expires_at, scopes
FROM connector_tokens
ORDER BY connected_at DESC;
```

Tokens are encrypted; the columns `encrypted_access_token` /
`encrypted_refresh_token` should look like `v1.<base64>.<base64>`.
