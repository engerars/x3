import {
  normalizeRoles,
  resolvePermissions,
  hasAnyRequiredRole,
} from "./rbac.module.js";

const GOOGLE_ID_TOKEN_STORAGE_KEY = "x3_google_id_token";
const GOOGLE_ROLE_OVERRIDES_STORAGE_KEY = "x3_google_role_overrides";

function resolveAuthority(config) {
  if (config.authority) return config.authority;
  const tenantId = (config.tenantId || "").trim();
  if (!tenantId || tenantId === "YOUR_TENANT_ID") {
    return "https://login.microsoftonline.com/common";
  }
  return `https://login.microsoftonline.com/${tenantId}`;
}

function resolveRedirectUri(config) {
  if (config.redirectUri) return config.redirectUri;
  return window.location.origin;
}

function getClaimArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  return [value];
}

function extractUserRoles(claims, roleClaimKeys) {
  const keys = Array.isArray(roleClaimKeys) && roleClaimKeys.length > 0
    ? roleClaimKeys
    : ["roles", "groups"];

  const roles = [];
  keys.forEach((key) => {
    const values = getClaimArray(claims?.[key]);
    values.forEach((v) => roles.push(v));
  });
  return normalizeRoles(roles);
}

function mapUser(account, tokenClaims, config, accessToken) {
  const claims = tokenClaims || account?.idTokenClaims || {};
  const roles = extractUserRoles(claims, config.roleClaimKeys);
  const permissions = resolvePermissions(
    roles,
    config.rolePermissions,
    config.defaultPermissions
  );
  const authorized = hasAnyRequiredRole(roles, config.requiredRoles);

  return {
    isAuthenticated: true,
    isAuthorized: authorized,
    account,
    accessToken: accessToken || null,
    roles,
    permissions,
    claims,
    provider: "microsoft-entra-id",
    profile: {
      id: account?.homeAccountId || claims?.oid || "",
      name: claims?.name || account?.name || "",
      username:
        account?.username ||
        claims?.preferred_username ||
        claims?.upn ||
        claims?.email ||
        "",
      tenantId: claims?.tid || "",
    },
  };
}

function decodeJwtPayload(jwt) {
  if (!jwt || typeof jwt !== "string") return {};
  const parts = jwt.split(".");
  if (parts.length < 2) return {};
  const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
  const pad = payload.length % 4;
  const padded = payload + (pad ? "=".repeat(4 - pad) : "");
  const json = atob(padded);
  return JSON.parse(json);
}

function getGoogleClientId(config) {
  const clientId = config?.google?.clientId || config?.clientId || "";
  if (!clientId || clientId === "YOUR_GOOGLE_CLIENT_ID") {
    throw new Error("GOOGLE_CLIENT_ID_MISSING");
  }
  return clientId;
}

function buildGoogleRoles(claims, config) {
  const roles = extractUserRoles(claims, config.roleClaimKeys);
  const email = (claims?.email || "").toLowerCase();
  const domain = (email.split("@")[1] || "").toLowerCase();

  const roleByEmail = config?.google?.roleByEmail || {};
  const roleOverrides = getStoredGoogleRoleOverrides();
  const effectiveRoleByEmail = {
    ...roleByEmail,
    ...roleOverrides,
  };
  const roleByDomain = config?.google?.roleByDomain || {};
  const mappedEmailRole = effectiveRoleByEmail[email];
  const mappedDomainRole = roleByDomain[domain];

  if (mappedEmailRole) roles.push(mappedEmailRole);
  if (mappedDomainRole) roles.push(mappedDomainRole);
  return normalizeRoles(roles);
}

function mapGoogleContextFromCredential(config, credential) {
  const claims = decodeJwtPayload(credential);
  const hostedDomain = (config?.google?.hostedDomain || "").trim().toLowerCase();
  const claimHd = (claims?.hd || "").toLowerCase();
  if (hostedDomain && claimHd && claimHd !== hostedDomain) {
    return {
      isAuthenticated: true,
      isAuthorized: false,
      provider: "google",
      claims,
      roles: [],
      permissions: [],
      accessToken: null,
      account: null,
      profile: {
        id: claims?.sub || "",
        name: claims?.name || "",
        username: claims?.email || "",
        tenantId: claimHd || "",
      },
    };
  }

  const roles = buildGoogleRoles(claims, config);
  const permissions = resolvePermissions(
    roles,
    config.rolePermissions,
    config.defaultPermissions
  );
  const authorized = hasAnyRequiredRole(roles, config.requiredRoles);

  return {
    isAuthenticated: true,
    isAuthorized: authorized,
    provider: "google",
    claims,
    roles,
    permissions,
    accessToken: null,
    account: null,
    profile: {
      id: claims?.sub || "",
      name: claims?.name || "",
      username: claims?.email || "",
      tenantId: claimHd || "",
    },
  };
}

function getStoredGoogleCredential() {
  try {
    return window.localStorage.getItem(GOOGLE_ID_TOKEN_STORAGE_KEY) || "";
  } catch (_error) {
    return "";
  }
}

function clearStoredGoogleCredential() {
  try {
    window.localStorage.removeItem(GOOGLE_ID_TOKEN_STORAGE_KEY);
  } catch (_error) {
    // no-op
  }
}

function storeGoogleCredential(credential) {
  try {
    window.localStorage.setItem(GOOGLE_ID_TOKEN_STORAGE_KEY, credential);
  } catch (_error) {
    // no-op
  }
}

function getStoredGoogleRoleOverrides() {
  try {
    const raw = window.localStorage.getItem(
      GOOGLE_ROLE_OVERRIDES_STORAGE_KEY
    );
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }

    const normalized = {};
    Object.entries(parsed).forEach(([email, role]) => {
      const normalizedEmail = (email || "").toString().trim().toLowerCase();
      const normalizedRole = (role || "").toString().trim().toLowerCase();
      if (normalizedEmail && normalizedRole) {
        normalized[normalizedEmail] = normalizedRole;
      }
    });
    return normalized;
  } catch (_error) {
    return {};
  }
}

function storeGoogleRoleOverrides(overrides) {
  try {
    const payload = overrides && typeof overrides === "object" ? overrides : {};
    window.localStorage.setItem(
      GOOGLE_ROLE_OVERRIDES_STORAGE_KEY,
      JSON.stringify(payload)
    );
  } catch (_error) {
    // no-op
  }
}

async function loginAndAcquireToken(msalInstance, config, loginRequest) {
  if ((config.loginMode || "popup") === "redirect") {
    await msalInstance.loginRedirect(loginRequest);
    return null;
  }

  const loginResult = await msalInstance.loginPopup(loginRequest);
  if (!loginResult?.account) return null;

  const tokenRequest = {
    scopes: loginRequest.scopes,
    account: loginResult.account,
  };
  const tokenResult = await msalInstance.acquireTokenSilent(tokenRequest);

  return {
    account: loginResult.account,
    claims: tokenResult?.idTokenClaims || loginResult.idTokenClaims,
    accessToken: tokenResult?.accessToken || null,
  };
}

async function authenticateWithMicrosoft(config) {
  if (!window.msal?.PublicClientApplication) {
    throw new Error("MSAL_NOT_AVAILABLE");
  }

  const authority = resolveAuthority(config);
  const redirectUri = resolveRedirectUri(config);
  const postLogoutRedirectUri = config.postLogoutRedirectUri || redirectUri;
  const scopes = Array.isArray(config.scopes) && config.scopes.length > 0
    ? config.scopes
    : ["openid", "profile", "email", "User.Read"];

  const msalConfig = {
    auth: {
      clientId: config.clientId,
      authority,
      redirectUri,
      postLogoutRedirectUri,
      navigateToLoginRequestUrl: false,
    },
    cache: {
      cacheLocation: "localStorage",
      storeAuthStateInCookie: false,
    },
  };

  const msalInstance = new window.msal.PublicClientApplication(msalConfig);

  if (typeof msalInstance.initialize === "function") {
    await msalInstance.initialize();
  }

  const redirectResult = await msalInstance.handleRedirectPromise();
  let account = redirectResult?.account || msalInstance.getAllAccounts()[0] || null;
  let tokenClaims = redirectResult?.idTokenClaims || null;
  let accessToken = null;

  const loginRequest = { scopes };

  if (!account) {
    const loginData = await loginAndAcquireToken(msalInstance, config, loginRequest);
    if (!loginData) {
      return { isAuthenticated: false, isAuthorized: false };
    }
    account = loginData.account;
    tokenClaims = loginData.claims;
    accessToken = loginData.accessToken;
  } else {
    try {
      const tokenResult = await msalInstance.acquireTokenSilent({
        scopes,
        account,
      });
      tokenClaims = tokenResult?.idTokenClaims || tokenClaims;
      accessToken = tokenResult?.accessToken || null;
    } catch (_error) {
      if ((config.loginMode || "popup") === "redirect") {
        await msalInstance.acquireTokenRedirect({ scopes, account });
        return { isAuthenticated: false, isAuthorized: false };
      }
      const tokenResult = await msalInstance.acquireTokenPopup({ scopes, account });
      tokenClaims = tokenResult?.idTokenClaims || tokenClaims;
      accessToken = tokenResult?.accessToken || null;
    }
  }

  const context = mapUser(account, tokenClaims, config, accessToken);
  context.logout = async () => {
    if ((config.loginMode || "popup") === "redirect") {
      await msalInstance.logoutRedirect({ account });
      return;
    }
    await msalInstance.logoutPopup({ account, postLogoutRedirectUri });
  };

  return context;
}

async function authenticateWithGoogle(config) {
  if (!window.google?.accounts?.id) {
    throw new Error("GOOGLE_IDENTITY_NOT_AVAILABLE");
  }

  getGoogleClientId(config);
  const credential = getStoredGoogleCredential();
  if (!credential) {
    return {
      isAuthenticated: false,
      isAuthorized: false,
      provider: "google",
      loginRequired: true,
    };
  }

  const context = mapGoogleContextFromCredential(config, credential);
  context.logout = async () => {
    clearStoredGoogleCredential();
    if (window.google?.accounts?.id?.disableAutoSelect) {
      window.google.accounts.id.disableAutoSelect();
    }
    window.location.reload();
  };
  return context;
}

async function authenticateWithSso(config) {
  if (!config?.enabled) {
    return {
      isAuthenticated: true,
      isAuthorized: true,
      roles: ["local.admin"],
      permissions: ["*"],
      profile: { name: "Local Admin", username: "local.admin" },
      claims: {},
      account: null,
      accessToken: null,
      disabled: true,
    };
  }

  const provider = (config.provider || "microsoft-entra-id").toLowerCase();
  if (provider === "google") {
    return authenticateWithGoogle(config);
  }
  return authenticateWithMicrosoft(config);
}

export {
  GOOGLE_ID_TOKEN_STORAGE_KEY,
  GOOGLE_ROLE_OVERRIDES_STORAGE_KEY,
  storeGoogleCredential,
  getStoredGoogleRoleOverrides,
  storeGoogleRoleOverrides,
  authenticateWithSso,
};
