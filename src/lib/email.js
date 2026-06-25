import { Resend } from "resend";

const apiKey = process.env.RESEND_API_KEY;
const FROM =
  process.env.EMAIL_FROM || "School Workforce <onboarding@resend.dev>";
const BASE_URL = process.env.AUTH_URL || "http://localhost:3000";

const resend = apiKey ? new Resend(apiKey) : null;

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

/** Sends an email. Silently skips (logs) when RESEND_API_KEY isn't set. */
export async function sendEmail(opts



) {
  if (!resend) {
    console.log(`[email skipped — no RESEND_API_KEY] "${opts.subject}" -> ${opts.to}`);
    return;
  }
  try {
    await resend.emails.send({
      from: FROM,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
    });
  } catch (err) {
    console.error("Email send failed:", err);
  }
}

export function taskUrl(taskId) {
  return `${BASE_URL}/tasks/${taskId}`;
}

export function meetingUrl(meetingId) {
  return `${BASE_URL}/meetings/${meetingId}`;
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
      `Hi ${args.assigneeName}, <strong>${args.assignerName}</strong> assigned you to the task <strong>${args.taskTitle}</strong>. Please review and accept it.`,
      { label: "Open task", href: taskUrl(args.taskId) }
    ),
  });
}

export async function emailTaskSubmitted(args





) {
  await sendEmail({
    to: args.to,
    subject: `Ready for review: ${args.taskTitle}`,
    html: layout(
      "A task was submitted for review",
      `Hi ${args.creatorName}, <strong>${args.byName}</strong> submitted their work on <strong>${args.taskTitle}</strong>. It's waiting for your review and approval.`,
      { label: "Review task", href: taskUrl(args.taskId) }
    ),
  });
}

export async function emailTaskApproved(args





) {
  await sendEmail({
    to: args.to,
    subject: `Approved: ${args.taskTitle}`,
    html: layout(
      "Your work was approved 🎉",
      `Hi ${args.assigneeName}, <strong>${args.byName}</strong> approved your work on <strong>${args.taskTitle}</strong>. Nice job!`,
      { label: "View task", href: taskUrl(args.taskId) }
    ),
  });
}
