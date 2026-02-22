import { APP_CONFIG } from "../../config/app.config.js";
import {
  authenticateWithSso,
  storeGoogleCredential,
} from "./modules/security/auth.module.js";

function escapeHtml(input) {
  return String(input || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function ensureSsoStyles() {
  if (document.getElementById("x3-sso-style")) return;

  const style = document.createElement("style");
  style.id = "x3-sso-style";
  style.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;600;700;800&family=Space+Grotesk:wght@500;700&display=swap');

    :root {
      --x3-bg-a: #0b132b;
      --x3-bg-b: #12355b;
      --x3-accent: #00a6fb;
      --x3-accent-2: #ffd166;
      --x3-card: rgba(255,255,255,0.86);
      --x3-ink: #0f172a;
      --x3-muted: #475569;
      --x3-border: rgba(148, 163, 184, 0.35);
      --x3-shadow: 0 20px 70px rgba(15, 23, 42, 0.35);
    }

    * { box-sizing: border-box; }

    .x3-sso-body {
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      padding: 24px;
      color: var(--x3-ink);
      font-family: "Manrope", "Segoe UI", sans-serif;
      background:
        radial-gradient(1200px 700px at 8% 10%, rgba(0,166,251,0.24), transparent 70%),
        radial-gradient(1000px 650px at 90% 90%, rgba(255,209,102,0.20), transparent 65%),
        linear-gradient(135deg, var(--x3-bg-a) 0%, var(--x3-bg-b) 100%);
    }

    .x3-sso-layer {
      position: fixed;
      inset: 0;
      pointer-events: none;
      overflow: hidden;
    }

    .x3-orb {
      position: absolute;
      border-radius: 999px;
      filter: blur(0.5px);
      opacity: 0.65;
      animation: x3Float 14s ease-in-out infinite;
    }

    .x3-orb-1 {
      width: 260px;
      height: 260px;
      left: -80px;
      top: 12vh;
      background: radial-gradient(circle at 35% 35%, rgba(0,166,251,0.85), rgba(0,166,251,0.14));
    }

    .x3-orb-2 {
      width: 300px;
      height: 300px;
      right: -100px;
      bottom: 8vh;
      animation-delay: 1.6s;
      background: radial-gradient(circle at 35% 35%, rgba(255,209,102,0.7), rgba(255,209,102,0.14));
    }

    .x3-sso-card {
      width: min(620px, 100%);
      border-radius: 24px;
      border: 1px solid var(--x3-border);
      padding: 28px;
      background: var(--x3-card);
      backdrop-filter: blur(12px) saturate(120%);
      box-shadow: var(--x3-shadow);
      transform: translateY(8px);
      opacity: 0;
      animation: x3Enter 600ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
    }

    .x3-badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      font-family: "Space Grotesk", sans-serif;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #0b5cab;
      background: rgba(0, 166, 251, 0.13);
      border: 1px solid rgba(0, 166, 251, 0.3);
      border-radius: 999px;
      padding: 7px 12px;
      margin-bottom: 16px;
    }

    .x3-badge.warn {
      color: #935b00;
      background: rgba(255, 209, 102, 0.2);
      border-color: rgba(255, 190, 79, 0.45);
    }

    .x3-title {
      margin: 0 0 10px;
      line-height: 1.15;
      font-weight: 800;
      font-size: clamp(28px, 5vw, 42px);
      font-family: "Space Grotesk", sans-serif;
      letter-spacing: -0.03em;
      color: #0a1020;
    }

    .x3-subtitle {
      margin: 0;
      line-height: 1.65;
      font-size: 15px;
      color: var(--x3-muted);
      max-width: 56ch;
    }

    .x3-actions {
      margin-top: 24px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      align-items: flex-start;
    }

    .x3-signin-wrap {
      width: 100%;
      display: flex;
      justify-content: flex-start;
    }

    .x3-footnote {
      margin-top: 14px;
      font-size: 12px;
      color: #64748b;
      line-height: 1.5;
    }

    .x3-extra {
      margin-top: 18px;
      font-size: 13px;
      color: #475569;
      line-height: 1.6;
      padding-top: 14px;
      border-top: 1px dashed rgba(100, 116, 139, 0.35);
    }

    @keyframes x3Enter {
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    @keyframes x3Float {
      0%, 100% { transform: translateY(0px) translateX(0px); }
      50% { transform: translateY(-14px) translateX(8px); }
    }

    @media (max-width: 640px) {
      .x3-sso-body { padding: 16px; }
      .x3-sso-card { border-radius: 18px; padding: 20px; }
      .x3-title { font-size: 30px; }
      .x3-signin-wrap { justify-content: center; }
      .x3-actions { align-items: stretch; }
    }
  `;
  document.head.appendChild(style);
}

function renderSsoLayout({
  badge = "Secure Access",
  badgeTone = "default",
  title = "",
  subtitle = "",
  actions = "",
  extra = "",
}) {
  ensureSsoStyles();
  document.body.className = "x3-sso-body";
  document.body.innerHTML = `
    <div class="x3-sso-layer" aria-hidden="true">
      <div class="x3-orb x3-orb-1"></div>
      <div class="x3-orb x3-orb-2"></div>
    </div>
    <main class="x3-sso-card" role="main" aria-live="polite">
      <div class="x3-badge ${badgeTone === "warn" ? "warn" : ""}">
        <span>${escapeHtml(badge)}</span>
      </div>
      <h1 class="x3-title">${escapeHtml(title)}</h1>
      <p class="x3-subtitle">${escapeHtml(subtitle)}</p>
      <div class="x3-actions">${actions || ""}</div>
      ${
        extra
          ? `<div class="x3-extra">${escapeHtml(extra)}</div>`
          : ""
      }
    </main>
  `;
}

function renderAuthMessage(title, message, extra = "") {
  renderSsoLayout({
    badge: "SSO Status",
    badgeTone: "warn",
    title,
    subtitle: message,
    actions: `<div class="x3-footnote">Please check the auth configuration and retry.</div>`,
    extra,
  });
}

function renderGoogleLoginScreen(authConfig) {
  const clientId = authConfig?.google?.clientId || authConfig?.clientId || "";
  renderSsoLayout({
    badge: "Google SSO",
    title: "Sign in to CPC Vision",
    subtitle: "Use your organization Google account to continue securely.",
    actions: `
      <div class="x3-signin-wrap">
        <div id="google-signin-button"></div>
      </div>
      <div class="x3-footnote">
        Your account roles and permissions will be verified after sign in.
      </div>
    `,
  });

  if (!window.google?.accounts?.id) {
    renderAuthMessage(
      "Thieu Google Identity SDK",
      "Khong the tai SDK dang nhap Google. Vui long kiem tra ket noi mang va refresh."
    );
    return;
  }

  if (!clientId || clientId === "YOUR_GOOGLE_CLIENT_ID") {
    renderAuthMessage(
      "Chua cau hinh Google Client ID",
      "Can cap nhat auth.google.clientId trong x3/config/app.config.js truoc khi dang nhap."
    );
    return;
  }

  const hostedDomain = (authConfig?.google?.hostedDomain || "").trim();
  window.google.accounts.id.initialize({
    client_id: clientId,
    callback: (response) => {
      if (!response?.credential) return;
      storeGoogleCredential(response.credential);
      window.location.reload();
    },
    cancel_on_tap_outside: false,
  });

  window.google.accounts.id.renderButton(
    document.getElementById("google-signin-button"),
    {
      theme: "filled_blue",
      size: "large",
      shape: "pill",
      width: 340,
      text: "signin_with",
    }
  );

  if (hostedDomain) {
    window.google.accounts.id.prompt();
  }
}

async function bootstrap() {
  try {
    const authContext = await authenticateWithSso(APP_CONFIG.auth);
    if (!authContext?.isAuthenticated) {
      if ((APP_CONFIG.auth?.provider || "").toLowerCase() === "google") {
        renderGoogleLoginScreen(APP_CONFIG.auth);
        return;
      }
      renderAuthMessage(
        "Dang cho xac thuc SSO",
        "Trinh duyet dang chuyen huong den cong dang nhap doanh nghiep."
      );
      return;
    }

    if (!authContext.isAuthorized) {
      const roles = (authContext.roles || []).join(", ") || "none";
      renderAuthMessage(
        "Khong duoc cap quyen",
        "Tai khoan da dang nhap thanh cong nhung khong thuoc nhom/role duoc phep su dung ung dung.",
        `Roles hien tai: ${roles}`
      );
      return;
    }

    window.__X3_AUTH_CONTEXT__ = authContext;
    await import("./modules/main-app.js");
  } catch (error) {
    console.error("[SSO Bootstrap Error]", error);
    renderAuthMessage(
      "Loi khoi tao SSO",
      "Khong the hoan tat dang nhap SSO. Vui long kiem tra cau hinh auth va thu lai.",
      `Chi tiet: ${error?.message || "Unknown error"}`
    );
  }
}

void bootstrap();
