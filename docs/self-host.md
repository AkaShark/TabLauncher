# Self-Host Guide (M1 placeholder)

This document will be completed in M10. The skeleton below documents the
**extension-id consistency contract** every fork must satisfy.

## Why the public key matters

Chrome derives an extension's permanent ID from its public key. We pin a `key`
field in `manifest.config.ts` so the extension-id is stable across reinstalls,
which is required for `chrome.identity` OAuth `redirect_uri` registration with
TickTick (and any other future OAuth provider).

The repository ships with a **placeholder public key**
(`<PLACEHOLDER_PUBKEY_BASE64>`). You **must** replace it before publishing or
running OAuth flows in production.

## Generating your own keypair (placeholder steps)

1. Generate an RSA 2048-bit private key with `openssl genrsa`.
2. Derive the public key in DER format.
3. Base64-encode the DER bytes.
4. Replace the `key` field in `manifest.config.ts` with the base64 string.
5. Compute the resulting extension-id (sha256 of the public key, mapped to
   a-p alphabet, first 32 chars).
6. Register that extension-id with your TickTick / OAuth providers as the
   allowed `redirect_uri` host.
7. Store the **private** key (`extension-priv.pem`) outside the repo —
   `keys/extension-pub.pem` is the only key that ships.
8. Confirm reinstalls keep the same ID.
9. Document any provider-specific allowlist updates in your fork's CHANGELOG.
10. (M10) Wire automation: `pnpm run keygen` will perform steps 1-5.

## TODO (M10)

- Concrete shell snippets for steps 1-3.
- ID derivation helper script.
- TickTick app registration walkthrough.
- Distribution checklist (Chrome Web Store vs unpacked self-host).
