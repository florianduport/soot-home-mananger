import nodemailer from "nodemailer";

const DEFAULT_FROM = "no-reply@soot.local";
const DEFAULT_BASE_URL = "http://localhost:3005";

type EmailServerConfig = {
  from: string;
  server: {
    host: string;
    port: number;
    secure: boolean;
    auth?: {
      user: string;
      pass: string;
    };
  };
};

function normalize(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function parsePort(value: string | undefined) {
  if (!value) {
    return undefined;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`EMAIL_SERVER_PORT invalide: "${value}"`);
  }
  return parsed;
}

export function getEmailServerConfig(): EmailServerConfig | null {
  const host = normalize(process.env.EMAIL_SERVER_HOST);
  const port = parsePort(normalize(process.env.EMAIL_SERVER_PORT));
  const user = normalize(process.env.EMAIL_SERVER_USER);
  const pass = normalize(process.env.EMAIL_SERVER_PASSWORD);
  const from = normalize(process.env.EMAIL_FROM) || DEFAULT_FROM;

  if (!host && !port && !user && !pass) {
    return null;
  }

  if (!host || !port) {
    throw new Error(
      "Configuration SMTP incomplète: EMAIL_SERVER_HOST et EMAIL_SERVER_PORT sont requis."
    );
  }

  const hasUser = Boolean(user);
  const hasPass = Boolean(pass);
  if (hasUser !== hasPass) {
    throw new Error(
      "Configuration SMTP incomplète: EMAIL_SERVER_USER et EMAIL_SERVER_PASSWORD doivent être définis ensemble."
    );
  }

  return {
    from,
    server: {
      host,
      port,
      secure: port === 465,
      auth: hasUser ? { user: user!, pass: pass! } : undefined,
    },
  };
}

export function hasEmailServerConfig() {
  return Boolean(getEmailServerConfig());
}

export function getAppBaseUrl() {
  const configuredUrl = normalize(process.env.NEXTAUTH_URL);

  if (!configuredUrl) {
    return DEFAULT_BASE_URL;
  }

  try {
    return new URL(configuredUrl).origin;
  } catch {
    console.warn(
      `NEXTAUTH_URL invalide ("${configuredUrl}"), utilisation de ${DEFAULT_BASE_URL}.`
    );
    return DEFAULT_BASE_URL;
  }
}

export function buildInviteUrl(token: string) {
  return new URL(`/invite/${token}`, `${getAppBaseUrl()}/`).toString();
}

export async function sendEmail(options: {
  to: string;
  subject: string;
  text: string;
  html: string;
}) {
  const emailConfig = getEmailServerConfig();
  if (!emailConfig) {
    return false;
  }

  const transport = nodemailer.createTransport(emailConfig.server);
  const result = await transport.sendMail({
    to: options.to,
    from: emailConfig.from,
    subject: options.subject,
    text: options.text,
    html: options.html,
  });

  const failed = result.rejected.concat(result.pending).filter(Boolean);
  if (failed.length) {
    throw new Error(`Email(s) non envoyés: ${failed.join(", ")}`);
  }

  return true;
}
