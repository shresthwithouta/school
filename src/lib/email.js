import nodemailer from "nodemailer";

const GMAIL_USER = process.env.GMAIL_USER;
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD;
const enabled = !!(GMAIL_USER && GMAIL_APP_PASSWORD);
const FROM = enabled ? `School Workforce <${GMAIL_USER}>` : "School Workforce";
const transporter = enabled
  ? nodemailer.createTransport({
      service: "gmail",
      auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD },
    })
  : null;

/** Base URL for links in emails — prefers AUTH_URL, then the Vercel domain. */
function baseUrl() {
  if (process.env.AUTH_URL) return process.env.AUTH_URL.replace(/\/$/, "");
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL)
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

function layout(title, body, cta) {
  return `
  <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#0f172a">
    <div style="font-weight:600;font-size:18px;margin-bottom:4px">SWM Platform</div>
    <div style="font-size:13px;color:#64748b;margin-bottom:20px">School Workforce Management</div>
    <h2 style="font-size:18px;margin:0 0 8px">${title}</h2>
    <div style="font-size:14px;line-height:1.6;color:#334155">${body}</div>
    ${
      cta
        ? `<a href="${cta.href}" style="display:inline-block;margin-top:18px;background:#4f46e5;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-size:14px;font-weight:500">${cta.label}</a>`
        : ""
    }
    <div style="margin-top:24px;font-size:12px;color:#94a3b8">You're receiving this because you have an account on the SWM Platform.</div>
  </div>`;
}

/** Sends an email via Gmail SMTP. Silently skips (logs) when Gmail isn't set. */
export async function sendEmail(opts



) {
  if (!transporter) {
    console.log(`[email skipped — Gmail not configured] "${opts.subject}" -> ${opts.to}`);
    return;
  }
  try {
    await transporter.sendMail({
      from: FROM,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
    });
  } catch (err) {
    console.error("Email send failed:", err?.message || err);
  }
}

export function taskUrl(taskId) {
  return `${baseUrl()}/tasks/${taskId}`;
}

export function meetingUrl(meetingId) {
  return `${baseUrl()}/meetings/${meetingId}`;
}

export async function emailMeetingInvite(args






) {
  await sendEmail({
    to: args.to,
    subject: `Meeting invite: ${args.title}`,
    html: layout(
      "You've been invited to a meeting",
      `Hi ${args.attendeeName}, <strong>${args.byName}</strong> invited you to <strong>${args.title}</strong>${
        args.when ? ` on <strong>${args.when}</strong>` : ""
      }. Open it to join and follow the discussion.`,
      { label: "Open meeting", href: meetingUrl(args.meetingId) }
    ),
  });
}

export async function emailTaskAssigned(args





) {
  await sendEmail({
    to: args.to,
    subject: `You've been assigned: ${args.taskTitle}`,
    html: layout(
      "You've been added to a task",
      `Hi ${args.assigneeName}, <strong>${args.assignerName}</strong> assigned you to the task <strong>${args.taskTitle}</strong>. Open it to get started.`,
      { label: "Open task", href: taskUrl(args.taskId) }
    ),
  });
}

export async function emailTaskCompleted(args





) {
  await sendEmail({
    to: args.to,
    subject: `Completed: ${args.taskTitle}`,
    html: layout(
      "A task was completed ✅",
      `Hi ${args.creatorName}, <strong>${args.byName}</strong> completed the task <strong>${args.taskTitle}</strong>.`,
      { label: "View task", href: taskUrl(args.taskId) }
    ),
  });
}
