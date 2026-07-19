# Security Policy

## Security Model

PromptVault is a **client-side-only** Progressive Web App. There is no backend server, no database, and no user accounts. All sensitive data lives exclusively in your browser's `localStorage`.

---

## Sensitive Data Storage

| Data | Where It Lives | Risk |
|------|---------------|------|
| GitHub Personal Access Token | `localStorage` (`pv_github_token`) | Anyone with physical access to your device/browser can read it via DevTools |
| Google Gemini API Key | `localStorage` (`pv_gemini_key`) | Same as above |

### What this means

- **Your tokens never leave your device** via PromptVault code — they are only sent directly to `api.github.com` and `generativelanguage.googleapis.com` in your browser.
- **No server ever sees your credentials.** The app has no backend to exfiltrate data to.
- **GitHub Pages is HTTPS-only.** The Clipboard API and Service Worker both require a secure context — the app will not function over plain HTTP.

---

## Token Scope Recommendations

### GitHub Personal Access Token

Grant the **minimum required scopes** only:

| Scope | Why |
|-------|-----|
| `repo` → `Contents` (read & write) | To publish, edit, and delete prompt files in the repo |

Do **not** grant: `admin`, `delete_repo`, `workflow`, or any organisation scopes.

> [!CAUTION]
> Treat your PAT like a password. If you believe it has been compromised, revoke it immediately at [github.com/settings/tokens](https://github.com/settings/tokens) and generate a new one.

### Google Gemini API Key

- Use a key obtained from [aistudio.google.com](https://aistudio.google.com) — the free tier is sufficient.
- Consider setting **API key restrictions** in Google AI Studio to limit the key to the Generative Language API only.
- Monitor usage at [aistudio.google.com](https://aistudio.google.com) to detect unexpected calls.

---

## Threat Model

| Threat | Risk Level | Mitigation |
|--------|-----------|------------|
| Physical device access | Medium | Tokens in `localStorage` are readable via DevTools — use a private/incognito session if concerned |
| XSS injection via prompt content | Low | User-supplied prompt text is rendered via `textContent` and `renderMarkdown()` which escapes `<`, `>`, `&` before rendering |
| Man-in-the-middle | Very Low | GitHub Pages enforces HTTPS; the app refuses to load over HTTP |
| Malicious prompt file in repo | Low | Prompt content is escaped before DOM insertion — no `innerHTML` with raw user data |
| Supply chain (npm) | Very Low | Vite is a dev-only dependency; `app.js` has zero runtime npm dependencies |

---

## Reporting a Vulnerability

If you discover a security issue, please **do not open a public GitHub issue**.

Instead, report it privately:

1. Go to the repository on GitHub
2. Click **Security → Report a vulnerability**
3. Provide a clear description of the issue, steps to reproduce, and potential impact

We aim to respond within **5 business days** and will credit responsible disclosures in the changelog.

---

## Out of Scope

The following are **not considered security issues** for this project:

- Tokens being visible in browser DevTools (by design — no backend to secure them server-side)
- Self-XSS (the user deliberately injecting scripts into their own browser)
- Rate limiting by GitHub or Google (third-party API concerns)
