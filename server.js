const crypto = require('crypto');
const express = require('express');
const bcrypt = require('bcrypt');
const cors = require('cors');

const pool = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

const AUTH_BASE_URL = process.env.AUTH_BASE_URL || 'https://thisnexus.cn';
const AUTH_COOKIE_NAME = process.env.AUTH_COOKIE_NAME || 'thisnexus_session';
const AUTH_FLOW_COOKIE_NAME =
  process.env.AUTH_FLOW_COOKIE_NAME || 'thisnexus_auth_flow';
const AUTH_SESSION_SECRET =
  process.env.AUTH_SESSION_SECRET ||
  (process.env.NODE_ENV === 'production'
    ? null
    : 'local-dev-secret-change-me');
const AUTH_SESSION_TTL_SECONDS = Number(
  process.env.AUTH_SESSION_TTL_SECONDS || 60 * 60 * 24 * 7
);
const AUTH_FLOW_TTL_SECONDS = Number(
  process.env.AUTH_FLOW_TTL_SECONDS || 60 * 10
);
const AUTH_COOKIE_DOMAIN =
  process.env.AUTH_COOKIE_DOMAIN ||
  (AUTH_BASE_URL.includes('thisnexus.cn') ? '.thisnexus.cn' : undefined);
const AUTH_COOKIE_SECURE =
  (process.env.AUTH_COOKIE_SECURE || '').toLowerCase() === 'true' ||
  AUTH_BASE_URL.startsWith('https://');
const MICROSOFT_TENANT_ID = process.env.MICROSOFT_TENANT_ID;
const MICROSOFT_CLIENT_ID = process.env.MICROSOFT_CLIENT_ID;
const MICROSOFT_CLIENT_SECRET = process.env.MICROSOFT_CLIENT_SECRET;
const MICROSOFT_REDIRECT_URI =
  process.env.MICROSOFT_REDIRECT_URI ||
  'https://thisnexus.cn/api/auth/callback';
const MICROSOFT_SCOPE =
  process.env.MICROSOFT_SCOPE || 'openid profile email';

const DEFAULT_ALLOWED_ORIGINS = [
  AUTH_BASE_URL,
  'https://thisnexus.cn',
  'https://mathgen.thisnexus.cn',
  'http://localhost:3000',
  'http://localhost:3006',
  'http://localhost:3088',
];

const ALLOWED_ORIGINS = [
  ...DEFAULT_ALLOWED_ORIGINS,
  ...(process.env.AUTH_ALLOWED_ORIGINS || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean),
];

const corsOptions = {
  origin(origin, callback) {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error(`Origin not allowed: ${origin}`));
  },
  credentials: true,
};

app.set('trust proxy', 1);

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

function ensureSessionSecret() {
  if (!AUTH_SESSION_SECRET) {
    throw new Error('AUTH_SESSION_SECRET is required');
  }
}

function parseCookies(req) {
  const rawCookieHeader = req.headers.cookie || '';
  return rawCookieHeader
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((acc, part) => {
      const separatorIndex = part.indexOf('=');
      if (separatorIndex === -1) {
        return acc;
      }

      const key = decodeURIComponent(part.slice(0, separatorIndex));
      const value = decodeURIComponent(part.slice(separatorIndex + 1));
      acc[key] = value;
      return acc;
    }, {});
}

function base64urlEncode(input) {
  const buffer = Buffer.isBuffer(input) ? input : Buffer.from(String(input));
  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function base64urlDecode(input) {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const padding = normalized.length % 4;
  const padded = padding ? normalized + '='.repeat(4 - padding) : normalized;
  return Buffer.from(padded, 'base64').toString('utf8');
}

function signValue(value) {
  ensureSessionSecret();
  return base64urlEncode(
    crypto.createHmac('sha256', AUTH_SESSION_SECRET).update(value).digest()
  );
}

function timingSafeEqual(left, right) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function encodeSignedPayload(payload) {
  const encodedPayload = base64urlEncode(JSON.stringify(payload));
  const signature = signValue(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

function decodeSignedPayload(token) {
  if (!token || !token.includes('.')) {
    return null;
  }

  const [encodedPayload, signature] = token.split('.');
  const expectedSignature = signValue(encodedPayload);

  if (!timingSafeEqual(signature, expectedSignature)) {
    return null;
  }

  try {
    const payload = JSON.parse(base64urlDecode(encodedPayload));
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      return null;
    }
    return payload;
  } catch (error) {
    return null;
  }
}

function getCookieOptions(maxAgeSeconds) {
  const options = {
    httpOnly: true,
    sameSite: 'lax',
    secure: AUTH_COOKIE_SECURE,
    path: '/',
    maxAge: maxAgeSeconds * 1000,
  };

  if (AUTH_COOKIE_DOMAIN) {
    options.domain = AUTH_COOKIE_DOMAIN;
  }

  return options;
}

function clearCookie(res, name) {
  const options = {
    httpOnly: true,
    sameSite: 'lax',
    secure: AUTH_COOKIE_SECURE,
    path: '/',
  };

  if (AUTH_COOKIE_DOMAIN) {
    options.domain = AUTH_COOKIE_DOMAIN;
  }

  res.clearCookie(name, options);
}

function createSessionPayload(user) {
  const issuedAt = Math.floor(Date.now() / 1000);
  return {
    ...user,
    iat: issuedAt,
    exp: issuedAt + AUTH_SESSION_TTL_SECONDS,
  };
}

function createTimedPayload(user, ttlSeconds) {
  const issuedAt = Math.floor(Date.now() / 1000);
  return {
    ...user,
    iat: issuedAt,
    exp: issuedAt + ttlSeconds,
  };
}

function getSessionFromRequest(req) {
  const cookies = parseCookies(req);
  return decodeSignedPayload(cookies[AUTH_COOKIE_NAME]);
}

function resolveRoleFromEmail(email) {
  if (!email) {
    return 'teacher';
  }

  return /\d/.test(email) ? 'student' : 'teacher';
}

function isAllowedReturnUrl(url) {
  const hostname = url.hostname.toLowerCase();

  return (
    hostname === 'thisnexus.cn' ||
    hostname.endsWith('.thisnexus.cn') ||
    hostname === 'localhost' ||
    hostname === '127.0.0.1'
  );
}

function sanitizeReturnTo(rawValue, fallbackPath = '/index.html') {
  const fallbackUrl = new URL(fallbackPath, AUTH_BASE_URL);

  if (!rawValue) {
    return fallbackUrl.toString();
  }

  try {
    const normalized = new URL(rawValue, AUTH_BASE_URL);
    if (!isAllowedReturnUrl(normalized)) {
      return fallbackUrl.toString();
    }
    return normalized.toString();
  } catch (error) {
    return fallbackUrl.toString();
  }
}

function buildLoginUrl(errorCode, returnTo) {
  const url = new URL('/login.html', AUTH_BASE_URL);
  if (errorCode) {
    url.searchParams.set('error', errorCode);
  }
  if (returnTo) {
    url.searchParams.set('returnTo', returnTo);
  }
  return url.toString();
}

function setSessionCookie(res, sessionPayload) {
  res.cookie(
    AUTH_COOKIE_NAME,
    encodeSignedPayload(sessionPayload),
    getCookieOptions(AUTH_SESSION_TTL_SECONDS)
  );
}

function setFlowCookie(res, flowPayload) {
  res.cookie(
    AUTH_FLOW_COOKIE_NAME,
    encodeSignedPayload(flowPayload),
    getCookieOptions(AUTH_FLOW_TTL_SECONDS)
  );
}

function decodeJwtPayload(idToken) {
  const parts = String(idToken || '').split('.');
  if (parts.length < 2) {
    return null;
  }

  try {
    return JSON.parse(base64urlDecode(parts[1]));
  } catch (error) {
    return null;
  }
}

async function verifyLegacyCredentials(username, password) {
  const result = await pool.query(
    'SELECT id, username, password_hash FROM users WHERE username = $1',
    [username]
  );

  if (result.rows.length === 0) {
    return null;
  }

  const user = result.rows[0];
  const isValid = await bcrypt.compare(password, user.password_hash);

  if (!isValid) {
    return null;
  }

  return {
    id: user.id,
    username: user.username,
  };
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'credential-database' });
});

// Backward-compatible credential verification endpoint.
app.post('/verify', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: 'Username and password are required',
      });
    }

    const user = await verifyLegacyCredentials(username, password);

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials',
      });
    }

    return res.json({
      success: true,
      user,
    });
  } catch (error) {
    console.error('Error verifying credentials:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const username = req.body?.username?.trim();
    const password = req.body?.password?.trim();

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: 'Username and password are required',
      });
    }

    const user = await verifyLegacyCredentials(username, password);

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials',
      });
    }

    const sessionPayload = createSessionPayload({
      authMethod: 'legacy',
      role: 'teacher',
      userId: user.id,
      username: user.username,
      name: user.username,
      email: null,
    });

    setSessionCookie(res, sessionPayload);

    return res.json({
      success: true,
      user: sessionPayload,
    });
  } catch (error) {
    console.error('Error creating legacy session:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

app.get('/api/auth/microsoft', (req, res) => {
  const returnTo = sanitizeReturnTo(req.query.returnTo);

  if (
    !MICROSOFT_TENANT_ID ||
    !MICROSOFT_CLIENT_ID ||
    !MICROSOFT_CLIENT_SECRET
  ) {
    return res.redirect(buildLoginUrl('microsoft_config', returnTo));
  }

  try {
    const state = crypto.randomBytes(24).toString('hex');
    const nonce = crypto.randomBytes(24).toString('hex');

    setFlowCookie(
      res,
      createTimedPayload(
        {
          state,
          nonce,
          returnTo,
        },
        AUTH_FLOW_TTL_SECONDS
      )
    );

    const authorizeUrl = new URL(
      `https://login.microsoftonline.com/${MICROSOFT_TENANT_ID}/oauth2/v2.0/authorize`
    );
    authorizeUrl.searchParams.set('client_id', MICROSOFT_CLIENT_ID);
    authorizeUrl.searchParams.set('response_type', 'code');
    authorizeUrl.searchParams.set('redirect_uri', MICROSOFT_REDIRECT_URI);
    authorizeUrl.searchParams.set('response_mode', 'query');
    authorizeUrl.searchParams.set('scope', MICROSOFT_SCOPE);
    authorizeUrl.searchParams.set('state', state);
    authorizeUrl.searchParams.set('nonce', nonce);

    return res.redirect(authorizeUrl.toString());
  } catch (error) {
    console.error('Error starting Microsoft sign-in:', error);
    return res.redirect(buildLoginUrl('microsoft_start_failed', returnTo));
  }
});

app.get('/api/auth/callback', async (req, res) => {
  const cookies = parseCookies(req);
  const flowPayload = decodeSignedPayload(cookies[AUTH_FLOW_COOKIE_NAME]);
  const fallbackReturnTo = sanitizeReturnTo(req.query.returnTo);

  if (req.query.error) {
    const returnTo = flowPayload?.returnTo || fallbackReturnTo;
    clearCookie(res, AUTH_FLOW_COOKIE_NAME);
    return res.redirect(buildLoginUrl('microsoft_denied', returnTo));
  }

  if (!flowPayload || !req.query.code || !req.query.state) {
    clearCookie(res, AUTH_FLOW_COOKIE_NAME);
    return res.redirect(buildLoginUrl('session_expired', fallbackReturnTo));
  }

  if (req.query.state !== flowPayload.state) {
    clearCookie(res, AUTH_FLOW_COOKIE_NAME);
    return res.redirect(buildLoginUrl('state_mismatch', flowPayload.returnTo));
  }

  try {
    const tokenUrl = `https://login.microsoftonline.com/${MICROSOFT_TENANT_ID}/oauth2/v2.0/token`;
    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: MICROSOFT_CLIENT_ID,
        client_secret: MICROSOFT_CLIENT_SECRET,
        code: String(req.query.code),
        grant_type: 'authorization_code',
        redirect_uri: MICROSOFT_REDIRECT_URI,
      }),
    });

    const tokenData = await tokenResponse.json().catch(() => null);

    if (!tokenResponse.ok || !tokenData?.id_token) {
      console.error('Microsoft token exchange failed:', tokenData);
      clearCookie(res, AUTH_FLOW_COOKIE_NAME);
      return res.redirect(
        buildLoginUrl('microsoft_token_failed', flowPayload.returnTo)
      );
    }

    const claims = decodeJwtPayload(tokenData.id_token);

    if (!claims) {
      clearCookie(res, AUTH_FLOW_COOKIE_NAME);
      return res.redirect(buildLoginUrl('microsoft_profile_failed', flowPayload.returnTo));
    }

    if (claims.nonce && claims.nonce !== flowPayload.nonce) {
      clearCookie(res, AUTH_FLOW_COOKIE_NAME);
      return res.redirect(buildLoginUrl('nonce_mismatch', flowPayload.returnTo));
    }

    const email =
      claims.email ||
      claims.preferred_username ||
      claims.upn ||
      claims.unique_name ||
      null;
    const name =
      claims.name ||
      [claims.given_name, claims.family_name].filter(Boolean).join(' ') ||
      email ||
      'Microsoft User';
    const sessionPayload = createSessionPayload({
      authMethod: 'microsoft',
      tenantId: claims.tid || MICROSOFT_TENANT_ID,
      subject: claims.sub,
      username: claims.preferred_username || email || claims.sub,
      name,
      email,
      role: resolveRoleFromEmail(email),
    });

    setSessionCookie(res, sessionPayload);
    clearCookie(res, AUTH_FLOW_COOKIE_NAME);

    return res.redirect(flowPayload.returnTo || sanitizeReturnTo(null));
  } catch (error) {
    console.error('Error completing Microsoft sign-in:', error);
    clearCookie(res, AUTH_FLOW_COOKIE_NAME);
    return res.redirect(
      buildLoginUrl('microsoft_sign_in_failed', flowPayload.returnTo)
    );
  }
});

app.get('/api/auth/session', (req, res) => {
  try {
    const session = getSessionFromRequest(req);

    if (!session) {
      return res.json({ authenticated: false, user: null });
    }

    return res.json({
      authenticated: true,
      user: session,
    });
  } catch (error) {
    console.error('Error reading session:', error);
    return res.status(500).json({
      authenticated: false,
      error: 'Failed to read session',
    });
  }
});

function handleLogout(req, res) {
  const returnTo = sanitizeReturnTo(req.body?.returnTo || req.query.returnTo, '/login.html');
  clearCookie(res, AUTH_COOKIE_NAME);
  clearCookie(res, AUTH_FLOW_COOKIE_NAME);

  if (req.method === 'GET') {
    return res.redirect(returnTo);
  }

  return res.json({ success: true });
}

app.post('/api/auth/logout', handleLogout);
app.get('/api/auth/logout', handleLogout);

// Check if user exists (useful for other services)
app.get('/user/:username', async (req, res) => {
  try {
    const { username } = req.params;

    const result = await pool.query(
      'SELECT id, username, created_at FROM users WHERE username = $1',
      [username]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        exists: false,
      });
    }

    return res.json({
      exists: true,
      user: result.rows[0],
    });
  } catch (error) {
    console.error('Error checking user:', error);
    return res.status(500).json({
      error: 'Internal server error',
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Credential database API running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});
