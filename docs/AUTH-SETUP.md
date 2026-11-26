# Current access mode

Microsoft login is temporarily disabled at the user's request. With `AUTH_MODE` unset, the application and survey API open without a Microsoft account. Only the allowlisted built browser assets are served; local private-data files remain excluded from deployment.

To restore Microsoft sign-in, set `AUTH_MODE=microsoft`, configure all settings below, and redeploy. In Microsoft mode, missing settings still deny access.

# Restricted Microsoft login (two users)

This is server-enforced authentication, not a client-side password screen. The application HTML, browser assets and survey API are gated. There is no automatic OneDrive connection, actual-data importer or shared data store in this change. Existing browser-local demo storage remains; authentication alone does not make it suitable for confidential records.

## Microsoft Entra setup by an authorized administrator

1. Register a single-tenant **Web** application in the company Entra tenant. Add redirect URI `https://YOUR-APP-HOST/auth/callback`. For local testing add `http://127.0.0.1:5173/auth/callback` if allowed by tenant policy.
2. Assign the two intended users to the enterprise application and enable **Assignment required**. Apply the organization's MFA / Conditional Access policy. If one person uses Gmail, the administrator must first invite and approve that person as an Entra B2B guest. Do not silently switch to a public multi-tenant application.
3. Obtain the tenant GUID, application client GUID, client secret and both users' immutable Object IDs in **this tenant**. Email addresses are not used as authorization identifiers.
4. Configure server environment settings using the deployment provider's secret settings. Never send secrets in chat, put them in browser JS, or commit them. The dev server reads process environment; it does not automatically load a dotenv file.

| Setting | Required value |
| --- | --- |
| `AUTH_MODE` | `microsoft` to enable restricted login |
| `AUTH_ORIGIN` | Exact HTTPS origin of the requested deployment; local HTTP only for localhost outside Vercel |
| `MICROSOFT_TENANT_ID` | Single company tenant GUID |
| `MICROSOFT_CLIENT_ID` | Registered Web application GUID |
| `MICROSOFT_CLIENT_SECRET` | Server-only client secret |
| `AUTH_ALLOWED_OBJECT_IDS` | Exactly two distinct authorized user GUIDs, separated by a comma |
| `AUTH_SESSION_SECRET` | Cryptographically random secret, at least 43 characters (generate 32 random bytes or more) |

No template containing credentials or actual user identities is included. Missing/invalid settings return HTTP 503 and do not serve the application. Invalid login is denied with a generic message. No password is collected by OmniKnow.

## Behavior and boundaries

- Authorization code flow with PKCE, state and nonce. ID token RSA signatures, issuer, tenant, audience, nonce, timestamps and user Object ID are checked on the server. Provider tokens and the client secret are never sent to the frontend or logged.
- Signed HttpOnly SameSite=Lax session cookie; Secure on HTTPS. Session expires after at most one hour and never after the ID token expires. The current two-ID allowlist is checked on every request; removing an ID blocks it immediately. Rotate the session secret to invalidate all cookies. Logout clears the local browser cookie; it does not revoke a stolen cookie or sign out the entire Microsoft account.
- Only `openid profile` scopes are requested. No Microsoft Graph/OneDrive permissions are requested.
- Source/API authorization is not row-level data authorization. Both allowed users receive the same application access. Existing prototype data lives in their separate browser profiles.
- The local development and preview servers bind to loopback and are intended for fictional demo data. Deployment uses the authenticated gateway.
- `vercel.json` uses an explicit catch-all route before filesystem handling. `api/gateway.js` serves only an allowlist of built files. Do not add public data files to dist or loosen routing. Deployment routing must be checked on a **private staging target** before any real records are loaded.
- No production deployment is authorized by this change. Verify the existing Vercel project and target first. Existing public deployments are unchanged until separately deployed.

## Verification

Run `node scripts/test-auth.mjs`, `npm run build` and `npm run check`. Unit/integration tests use fictional users and locally generated RSA keys. They verify rejection of unauthorized/malformed/expired tokens and anonymous requests. They do not establish a real Microsoft login or actual Vercel routing.

Before actual-data use, verify the two real users, an unassigned third user, anonymous direct HTML/assets/API URLs, logout, cookie flags and session expiry in private staging. Configure backup/retention and a separate secure data-storage design. Do not commit original Excel, exports, logs, `.env`, or deployment credentials.

References: https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-auth-code-flow ; https://learn.microsoft.com/en-us/entra/identity-platform/claims-validation ; https://vercel.com/docs/project-configuration
