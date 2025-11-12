# SSL Certificate Verification Modifications

**Date:** 2025-11-11
**Purpose:** Disable SSL certificate verification for custom Signal server deployment

## Overview
This document records all modifications made to disable SSL/TLS certificate verification in Signal-Desktop to support custom server deployments with self-signed or custom CA certificates.

## ⚠️ Security Warning
**IMPORTANT:** Disabling SSL certificate verification removes an important security layer. These modifications should ONLY be used in:
- Development/testing environments
- Trusted private networks
- Internal enterprise deployments with known custom servers

**DO NOT** use these modifications when connecting to public/untrusted servers.

---

## Modified Files

### 1. `app/config.ts`

**Lines Modified:** 34-36, 42-43

**Changes:**
```typescript
// Development mode - Added at line 34-36
if (getEnvironment() !== Environment.PackagedApp) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

// Production/Packaged mode - Modified at line 42
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
```

**Reason:** Sets the Node.js environment variable to disable TLS certificate rejection globally for both development and production modes.

---

### 2. `ts/textsecure/WebSocket.ts`

**Line Modified:** 67

**Changes:**
```typescript
const client = new WebSocketClient({
  tlsOptions: {
    ca: certificateAuthority,
    agent: proxyAgent ?? createHTTPSAgent(),
    // MODIFIED: Disable SSL certificate verification for custom servers
    rejectUnauthorized: false,  // ← Added this line
  },
  maxReceivedFrameSize: 0x210000,
});
```

**Reason:** Disables certificate verification for WebSocket connections to Signal servers.

---

### 3. `ts/util/createHTTPSAgent.ts`

**Line Modified:** 90

**Changes:**
```typescript
const { socket, address, v4Attempts, v6Attempts } = await happyEyeballs({
  addresses,
  port,
  tlsOptions: {
    ca: options.ca,
    servername: options.servername ?? dropNull(options.host),
    // MODIFIED: Disable SSL certificate verification for custom servers
    rejectUnauthorized: false,  // ← Added this line
  },
});
```

**Reason:** Disables certificate verification for HTTPS agent connections used throughout the application.

---

### 4. `ts/textsecure/WebAPI.ts`

**Line Modified:** 361

**Changes:**
```typescript
const fetchOptions: FetchOptionsType = {
  method: options.type,
  body: typeof options.data === 'function' ? options.data() : options.data,
  headers: {
    'User-Agent': getUserAgent(options.version),
    'X-Signal-Agent': 'OWD',
    ...options.headers,
  } as FetchHeaderListType,
  redirect: options.redirect,
  agent,
  ca: options.certificateAuthority,
  // MODIFIED: Disable SSL certificate verification for custom servers
  rejectUnauthorized: false,  // ← Added this line
  timeout,
  signal: options.abortSignal,
};
```

**Reason:** Disables certificate verification for all HTTP/HTTPS API requests to Signal servers.

---

## Impact Analysis

### Affected Components:
1. **WebSocket Connections** - All persistent connections to chat servers
2. **REST API Calls** - All HTTP/HTTPS requests to Signal backend services
3. **HTTPS Agent** - Low-level TLS connection establishment
4. **Node.js Global Settings** - System-wide TLS verification behavior

### Services Affected:
- Chat messaging (WebSocket)
- User registration/authentication (REST API)
- Media upload/download (REST API)
- Profile updates (REST API)
- Group management (REST API)
- All other backend communications

---

## How to Revert

To restore SSL certificate verification, reverse the following changes:

1. **app/config.ts:**
   - Remove lines 34-36
   - Change line 42 back to: `process.env.NODE_TLS_REJECT_UNAUTHORIZED = '';`

2. **ts/textsecure/WebSocket.ts:**
   - Remove line 67: `rejectUnauthorized: false,`

3. **ts/util/createHTTPSAgent.ts:**
   - Remove line 90: `rejectUnauthorized: false,`

4. **ts/textsecure/WebAPI.ts:**
   - Remove line 361: `rejectUnauthorized: false,`

5. Rebuild the application:
   ```bash
   pnpm build
   ```

---

## Testing Checklist

After making these changes, verify:

- [ ] Application starts successfully
- [ ] Can scan QR code for device linking
- [ ] Can send/receive messages
- [ ] Can upload/download media
- [ ] WebSocket connection remains stable
- [ ] No certificate-related errors in console

---

## Additional Notes

- These modifications work with the custom server configuration in `config/default.json`
- The `certificateAuthority` field in config can be left as-is or removed since verification is disabled
- No rebuild is required if only changing `config/*.json` files
- Rebuild IS required after modifying TypeScript source files

---

## Rollback Instructions

If you need to quickly rollback:

```bash
git checkout app/config.ts ts/textsecure/WebSocket.ts ts/util/createHTTPSAgent.ts ts/textsecure/WebAPI.ts
pnpm build
```

---

**Modified by:** Claude Code
**Last Updated:** 2025-11-11
