import nodemailer from "nodemailer";

const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM, APP_URL } =
  process.env;

let transporter = null;
if (SMTP_HOST) {
  const port = Number(SMTP_PORT) || 587;
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    secure: port === 465,
    auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
  });
}

export async function sendInviteEmail({ to, teamName, inviterEmail, inviteCode }) {
  if (!transporter) {
    console.log(
      `[invite] SMTP not configured; invitation for ${to} to "${teamName}" stored in-app.`
    );
    return false;
  }

  const link = APP_URL ? `\n\nOpen the app: ${APP_URL}` : "";
  await transporter.sendMail({
    from: SMTP_FROM || SMTP_USER,
    to,
    subject: `You are invited to join ${teamName}`,
    text:
      `${inviterEmail} invited you to join the team "${teamName}" on Tasks & History.` +
      `\n\nSign in with this email address to accept the invitation.` +
      `${link}\n\nInvite code: ${inviteCode}`,
  });
  return true;
}
