import nodemailer from "nodemailer";

const GMAIL_USER = process.env.GMAIL_USER;
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD;
const enabled = !!(GMAIL_USER && GMAIL_APP_PASSWORD);
const FROM = enabled ? `School Workforce <${GMAIL_USER}>` : "School Workforce";
const transporter = enabled
  ? nodemailer.createTransport({
      service: "gmail",
      auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD },
      // Keep one SMTP connection warm and reuse it across sends so a burst of
      // notifications (e.g. assigning many people) doesn't re-handshake each time.
      pool: true,
      maxConnections: 3,
      maxMessages: 100,
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

/** Escape a user-controlled value before it goes into email HTML. */
function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
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
export async function sendEmail(opts) {
  if (!transporter) {
    console.log(`[email skipped — Gmail not configured] "${opts.subject}" -> ${opts.to}`);
    return;
  }
  try {
    await transporter.sendMail({
      from: FROM,
      to: opts.to,
      // cc may be a single address or an array — nodemailer accepts both.
      ...(opts.cc && opts.cc.length ? { cc: opts.cc } : {}),
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

export function subtaskUrl(taskId, subKey) {
  return `${baseUrl()}/tasks/${taskId}/${subKey}`;
}

export function meetingUrl(meetingId) {
  return `${baseUrl()}/meetings/${meetingId}`;
}

export function recurringUrl(recurringId) {
  return `${baseUrl()}/recurring/${recurringId}`;
}

/** A "When:" / "Join link:" detail block for meeting emails (omits blank rows). */
function meetingDetails(args) {
  const rows = [];
  if (args.when) {
    rows.push(
      `<div style="margin-top:6px"><span style="color:#64748b">When:</span> <strong>${esc(args.when)}</strong></div>`
    );
  }
  if (args.link) {
    rows.push(
      `<div style="margin-top:6px"><span style="color:#64748b">Join link:</span> <a href="${esc(args.link)}" style="color:#4f46e5">${esc(args.link)}</a></div>`
    );
  }
  return rows.join("");
}

export async function emailMeetingInvite(args) {
  await sendEmail({
    to: args.to,
    subject: `Meeting invite: ${args.title}`,
    html: layout(
      "You've been invited to a meeting",
      `Hi ${esc(args.attendeeName)}, <strong>${esc(args.byName)}</strong> invited you to <strong>${esc(args.title)}</strong>. Open it to join and follow the discussion.${meetingDetails(args)}`,
      { label: "Open meeting", href: meetingUrl(args.meetingId) }
    ),
  });
}

/**
 * One meeting invite for the whole group: addressed to the organizer with every
 * attendee in CC, so the team can see who else is invited (instead of N separate
 * emails). Includes the schedule and the join link. Used for 2+ invitees.
 */
export async function emailMeetingInviteGroup(args) {
  await sendEmail({
    to: args.to,
    cc: args.cc,
    subject: `Meeting invite: ${args.title}`,
    html: layout(
      "You've been invited to a meeting",
      `<strong>${esc(args.byName)}</strong> invited ${esc(args.attendeeNames)} to <strong>${esc(args.title)}</strong>. Open it to join and follow the discussion.${meetingDetails(args)}`,
      { label: "Open meeting", href: meetingUrl(args.meetingId) }
    ),
  });
}

export async function emailTaskAssigned(args) {
  await sendEmail({
    to: args.to,
    subject: `You've been assigned: ${args.taskTitle}`,
    html: layout(
      "You've been added to a task",
      `Hi ${esc(args.assigneeName)}, <strong>${esc(args.assignerName)}</strong> assigned you to the task <strong>${esc(args.taskTitle)}</strong>. Open it to get started.`,
      { label: "Open task", href: taskUrl(args.taskId) }
    ),
  });
}

/**
 * One assignment email for a whole group: addressed to the assigner with every
 * assignee in CC, so the team can see who else is on the task (instead of N
 * separate, isolated emails). Used when more than one person is assigned at once.
 */
export async function emailTaskAssignedGroup(args) {
  await sendEmail({
    to: args.to,
    cc: args.cc,
    subject: `New task assigned: ${args.taskTitle}`,
    html: layout(
      "A task was assigned to your team",
      `<strong>${esc(args.assignerName)}</strong> assigned the task <strong>${esc(args.taskTitle)}</strong> to ${esc(args.assigneeNames)}. Open it to get started.`,
      { label: "Open task", href: taskUrl(args.taskId) }
    ),
  });
}

/**
 * To an assignee: today's occurrence of a recurring task was generated. Sent
 * fresh each period by the recurring-task job (see spawnDueRecurringTasks).
 */
export async function emailTaskRecurring(args) {
  const cadence = args.freq === "weekdays" ? "daily (Mon–Sat)" : "daily";
  await sendEmail({
    to: args.to,
    subject: `Today's task: ${args.taskTitle}`,
    html: layout(
      "Your recurring task for today 🔁",
      `Hi ${esc(args.assigneeName)}, this is your ${esc(cadence)} task <strong>${esc(args.taskTitle)}</strong>${
        args.assignerName ? `, set by <strong>${esc(args.assignerName)}</strong>` : ""
      }. It's due by the end of today — open it to complete and submit.`,
      { label: "Open task", href: taskUrl(args.taskId) }
    ),
  });
}

/**
 * To an assignee: they've been added to a recurring task. Unlike the old flow,
 * nothing is cloned — they open the one task and upload a result each due day.
 */
export async function emailRecurringAssigned(args) {
  await sendEmail({
    to: args.to,
    subject: `Recurring task assigned: ${args.taskTitle}`,
    html: layout(
      "You've been added to a recurring task 🔁",
      `Hi ${esc(args.assigneeName)}, <strong>${esc(args.assignerName)}</strong> added you to the recurring task <strong>${esc(args.taskTitle)}</strong>${
        args.cadence ? ` (${esc(args.cadence)})` : ""
      }. Open it and upload your result on each scheduled day — the whole log stays visible to you and your reviewers.`,
      { label: "Open recurring task", href: recurringUrl(args.recurringId) }
    ),
  });
}

/** A daily nudge to an assignee who hasn't logged today's recurring result. */
export async function emailRecurringReminder(args) {
  await sendEmail({
    to: args.to,
    subject: `Today's log: ${args.taskTitle}`,
    html: layout(
      "Your recurring task needs today's result ⏰",
      `Hi ${esc(args.assigneeName)}, you haven't uploaded today's result for <strong>${esc(args.taskTitle)}</strong> yet. Open it to add your note and any files.`,
      { label: "Upload today's result", href: recurringUrl(args.recurringId) }
    ),
  });
}

export async function emailSubtaskAssigned(args) {
  await sendEmail({
    to: args.to,
    subject: `You've been assigned a subtask: ${args.subtaskTitle}`,
    html: layout(
      "You've been assigned a subtask",
      `Hi ${esc(args.assigneeName)}, <strong>${esc(args.assignerName)}</strong> assigned you the subtask <strong>${esc(args.subtaskTitle)}</strong> under the task <strong>${esc(args.taskTitle)}</strong>. Open it to get started.`,
      { label: "Open subtask", href: subtaskUrl(args.taskId, args.subtaskKey) }
    ),
  });
}

/** To an assignee: their task passed its due date and is now overdue. */
export async function emailTaskDelayed(args) {
  await sendEmail({
    to: args.to,
    subject: `Overdue: ${args.taskTitle}`,
    html: layout(
      "Your task is now overdue ⚠️",
      `Hi ${esc(args.assigneeName)}, the task <strong>${esc(args.taskTitle)}</strong> was due ${args.daysLate} day${args.daysLate === 1 ? "" : "s"} ago. Open it to update your progress.`,
      { label: "Open task", href: taskUrl(args.taskId) }
    ),
  });
}

/** To a subtask's assignee: it passed its expected date and is now overdue. */
export async function emailSubtaskDelayed(args) {
  await sendEmail({
    to: args.to,
    subject: `Overdue: ${args.subtaskTitle}`,
    html: layout(
      "Your subtask is now overdue ⚠️",
      `Hi ${esc(args.assigneeName)}, the subtask <strong>${esc(args.subtaskTitle)}</strong> under <strong>${esc(args.taskTitle)}</strong> was due ${args.daysLate} day${args.daysLate === 1 ? "" : "s"} ago. Open it to update your progress.`,
      { label: "Open subtask", href: subtaskUrl(args.taskId, args.subtaskKey) }
    ),
  });
}

export async function emailTaskCompleted(args) {
  await sendEmail({
    to: args.to,
    subject: `Completed: ${args.taskTitle}`,
    html: layout(
      "A task was completed ✅",
      `Hi ${esc(args.creatorName)}, <strong>${esc(args.byName)}</strong> completed the task <strong>${esc(args.taskTitle)}</strong>.`,
      { label: "View task", href: taskUrl(args.taskId) }
    ),
  });
}

/** To the assigner: an assignee submitted their part for review. */
export async function emailTaskSubmitted(args) {
  await sendEmail({
    to: args.to,
    subject: `Submitted for review: ${args.taskTitle}`,
    html: layout(
      "Work submitted for review 📝",
      `Hi ${esc(args.creatorName)}, <strong>${esc(args.byName)}</strong> submitted their part of <strong>${esc(args.taskTitle)}</strong> for your review. Open it to approve or send it back.`,
      { label: "Review task", href: taskUrl(args.taskId) }
    ),
  });
}

/** To the assignee: their submission was sent back for changes. */
export async function emailSubmissionReturned(args) {
  await sendEmail({
    to: args.to,
    subject: `Changes requested: ${args.taskTitle}`,
    html: layout(
      "Your submission was sent back",
      `Hi ${esc(args.assigneeName)}, <strong>${esc(args.byName)}</strong> sent your submission for <strong>${esc(args.taskTitle)}</strong> back for changes.${
        args.reason ? ` Reason: ${esc(args.reason)}.` : ""
      } Open it to update and resubmit.`,
      { label: "Open task", href: taskUrl(args.taskId) }
    ),
  });
}

/** To the assignee: their individual submission on the task was approved. */
export async function emailTaskApproved(args) {
  await sendEmail({
    to: args.to,
    subject: `Approved: ${args.taskTitle}`,
    html: layout(
      "Your submission was approved ✅",
      `Hi ${esc(args.assigneeName)}, <strong>${esc(args.byName)}</strong> approved your submission for <strong>${esc(args.taskTitle)}</strong>.`,
      { label: "View task", href: taskUrl(args.taskId) }
    ),
  });
}

/** To a subtask reviewer (its creator, the task creator, or a manager): submitted for review. */
export async function emailSubtaskSubmitted(args) {
  await sendEmail({
    to: args.to,
    subject: `Submitted for review: ${args.subtaskTitle}`,
    html: layout(
      "Subtask submitted for review 📝",
      `Hi ${esc(args.recipientName)}, <strong>${esc(args.byName)}</strong> submitted the subtask <strong>${esc(args.subtaskTitle)}</strong> (under <strong>${esc(args.taskTitle)}</strong>) for your review. Open it to approve or send it back.`,
      { label: "Review subtask", href: subtaskUrl(args.taskId, args.subtaskKey) }
    ),
  });
}

/** To the subtask assignee: their subtask was approved. */
export async function emailSubtaskApproved(args) {
  await sendEmail({
    to: args.to,
    subject: `Approved: ${args.subtaskTitle}`,
    html: layout(
      "Your subtask was approved ✅",
      `Hi ${esc(args.assigneeName)}, <strong>${esc(args.byName)}</strong> approved your subtask <strong>${esc(args.subtaskTitle)}</strong> (under <strong>${esc(args.taskTitle)}</strong>).`,
      { label: "View subtask", href: subtaskUrl(args.taskId, args.subtaskKey) }
    ),
  });
}

/** To the subtask assignee: their subtask submission was sent back for changes. */
export async function emailSubtaskReturned(args) {
  await sendEmail({
    to: args.to,
    subject: `Changes requested: ${args.subtaskTitle}`,
    html: layout(
      "Your subtask was sent back",
      `Hi ${esc(args.assigneeName)}, <strong>${esc(args.byName)}</strong> sent your subtask <strong>${esc(args.subtaskTitle)}</strong> (under <strong>${esc(args.taskTitle)}</strong>) back for changes. Open it to update and resubmit.`,
      { label: "Open subtask", href: subtaskUrl(args.taskId, args.subtaskKey) }
    ),
  });
}

/** To a mentioned person: they were @mentioned in a (private) task comment. */
export async function emailMention(args) {
  await sendEmail({
    to: args.to,
    subject: `You were mentioned: ${args.taskTitle}`,
    html: layout(
      "You were mentioned in a comment",
      `Hi ${esc(args.mentionedName)}, <strong>${esc(args.byName)}</strong> mentioned you in a comment on <strong>${esc(args.taskTitle)}</strong>. Open the task to read it and reply.`,
      { label: "Open task", href: taskUrl(args.taskId) }
    ),
  });
}
