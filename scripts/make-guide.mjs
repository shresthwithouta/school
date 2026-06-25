import PDFDocument from "pdfkit";
import { createWriteStream, mkdirSync } from "fs";

mkdirSync("docs", { recursive: true });

const INDIGO = "#4338ca";
const SLATE = "#0f172a";
const GRAY = "#475569";
const LIGHT = "#94a3b8";

const doc = new PDFDocument({
  size: "A4",
  margins: { top: 64, bottom: 64, left: 64, right: 64 },
  info: { Title: "SWM Platform — User Guide", Author: "SWM Platform" },
});
doc.pipe(createWriteStream("docs/SWM-User-Guide.pdf"));

const bottom = () => doc.page.height - doc.page.margins.bottom;
function ensure(space) {
  if (doc.y + space > bottom()) doc.addPage();
}
function h1(t) {
  ensure(70);
  doc.moveDown(0.8);
  doc.fillColor(INDIGO).font("Helvetica-Bold").fontSize(16).text(t);
  doc
    .moveTo(doc.x, doc.y + 2)
    .lineTo(doc.page.width - doc.page.margins.right, doc.y + 2)
    .strokeColor("#e2e8f0")
    .stroke();
  doc.moveDown(0.6);
  doc.fillColor(SLATE);
}
function h2(t) {
  ensure(46);
  doc.moveDown(0.5);
  doc.fillColor(SLATE).font("Helvetica-Bold").fontSize(12).text(t);
  doc.moveDown(0.25);
}
function p(t) {
  doc.fillColor(GRAY).font("Helvetica").fontSize(10.5).text(t, { lineGap: 2.5 });
  doc.moveDown(0.35);
}
function bullet(t) {
  doc
    .fillColor(GRAY)
    .font("Helvetica")
    .fontSize(10.5)
    .text(t, { indent: 14, lineGap: 2.5, bulletRadius: 1.6, listType: "bullet" });
}
function bullets(items) {
  doc.fillColor(GRAY).font("Helvetica").fontSize(10.5);
  doc.list(items, { bulletRadius: 1.6, textIndent: 14, lineGap: 2.5, bulletIndent: 4 });
  doc.moveDown(0.35);
}
function steps(items) {
  doc.fillColor(GRAY).font("Helvetica").fontSize(10.5);
  doc.list(items, { listType: "numbered", textIndent: 16, lineGap: 2.5 });
  doc.moveDown(0.35);
}

// ── Cover ──────────────────────────────────────────────────────────
doc.moveDown(6);
doc.fillColor(INDIGO).font("Helvetica-Bold").fontSize(30).text("SWM Platform");
doc.fillColor(SLATE).font("Helvetica-Bold").fontSize(16).text("School Workforce Management");
doc.moveDown(0.6);
doc.fillColor(GRAY).font("Helvetica").fontSize(13).text("User Guide");
doc.moveDown(2);
doc
  .fillColor(GRAY)
  .font("Helvetica")
  .fontSize(11)
  .text(
    "An internal tool for school staff to assign, track, review and evaluate work, " +
      "run meetings, and see performance — all organised by role.",
    { width: 380, lineGap: 3 }
  );
doc.moveDown(4);
doc.fillColor(LIGHT).fontSize(9).text("Staff use only — accounts are issued by your administrator.");

// ── Sections ───────────────────────────────────────────────────────
doc.addPage();

h1("1. Getting started");
h2("Signing in");
p("There is no public sign-up. Your administrator creates your account and gives you an email and a password.");
steps([
  "Open the website link your administrator shared.",
  "Enter the email and password you were given.",
  "Click Sign in. You'll land on your Dashboard.",
]);
p("If your password doesn't work, ask your administrator to reset it. You can change it yourself later from your Profile.");
h2("Light or dark mode");
p("The app opens in light mode. Use the sun/moon button in the top-right to switch to dark mode at any time; your choice is remembered on that device.");

h1("2. Understanding roles");
p("What you can see and do depends on your role. There are three levels:");
bullets([
  "Owner (Chairman/Director): sees everyone and every task; manages all accounts.",
  "Admin (Principal, Coordinators, Managers): sees Admins and Workers and their tasks; can add Worker accounts.",
  "Worker (Teachers, Accountant, Team Members): sees their own tasks and the people they work with.",
]);
p("You only ever see what your role allows — the menu and pages adjust automatically.");

h1("3. The Dashboard");
p("The Dashboard is your home screen. It shows:");
bullets([
  "Task counts: Pending, In progress, Completed and Overdue at a glance.",
  "My tasks: the open work assigned to you, sorted by due date.",
  "Team overview (managers only): how many people you oversee and who was added recently.",
]);
p("Use the sidebar on the left to move between Dashboard, Tasks, Meetings, Team, Analytics and your Profile.");

h1("4. Tasks");
h2("Creating a task");
steps([
  "Go to Tasks and click New task.",
  "Enter a Title and a Description (you can make text bold, italic, add bullet or numbered lists).",
  "Under Assign to, type a name — matching people appear; click to add one or more.",
  "Choose a Priority (Low, Medium, High, Urgent) and a Due date.",
  "Click Create task.",
]);
p("You can assign a task to several people at once. You can only assign to people at or below your level — you cannot assign work to someone above you.");

h2("The task page");
p("Click any task to open its own page. There you'll find the description, everyone assigned (with their individual progress), subtasks, comments, an activity history, and the action buttons relevant to you.");

h2("The task workflow");
p("Every task moves through these stages. Each assignee handles their own part:");
steps([
  "Assigned — the task is waiting for you to accept it.",
  "Accept — click Accept to take it on. (A task stays Pending until accepted.)",
  "Start work / update progress — use the slider to show how far along you are.",
  "Submit for review — when finished, submit it to the person who created the task.",
  "Review — the creator approves it or sends it back with feedback.",
  "Completed — once approved, your part is done.",
]);
p("If the creator requests changes, the task returns to In progress with their feedback so you can fix and resubmit.");

h2("Subtasks");
p("The task creator can break a task into subtasks (a simple checklist). Each subtask can have its own assignee, an expected date set by the creator, and a status of To do / In progress / Done. Subtasks are one level deep — a subtask cannot have its own subtasks.");

h2("Comments and replies");
p("Use the comments section to discuss the task. Comments support formatting, and you can reply to a specific comment to keep conversations threaded (like a discussion board). Feedback left during a review is highlighted.");

h2("Attachments (files & voice)");
p("You can attach files, images, or a voice note to a task or a comment. Use the attach button to upload a file, or the microphone to record a short voice message. Voice recording works on secure (https) sites and on your computer.");

h2("Editing or deleting a task");
p("Only the person who created a task can edit it, delete it, change its people, or manage its subtasks. Everyone else can still do their assigned part, comment and attach files.");

h1("5. Reviewing & evaluating work");
p("When someone submits their part, the task creator reviews it from the task page:");
bullets([
  "Approve — you rate the work on three criteria: Timeliness, Quality and Accuracy (1 to 5 stars). The average is recorded, and the assignee's part is marked Completed.",
  "Request changes — you write feedback explaining what to fix; the task returns to the assignee.",
]);
p("These ratings feed the Analytics page so you can see how your team is performing over time.");

h1("6. Meetings");
p("Open Meetings to schedule and run staff meetings.");
bullets([
  "Create a meeting with a title, time and the people invited.",
  "On the meeting page, post messages, share files, or leave a voice note.",
  "Invited people Join the meeting so attendance is recorded.",
  "When finished, End the meeting — a summary captures who attended and the discussion.",
]);
p("Meetings you're part of also appear on your Dashboard.");

h1("7. Analytics (managers)");
p("The Analytics page gives leaders a clear performance picture across the team:");
bullets([
  "Total tasks, how many are completed, and the overall completion rate.",
  "Average time to complete work, and how many tasks are overdue.",
  "A per-person table: assigned, completed, in progress, overdue, average completion time and average rating.",
]);
p("Workers don't see Analytics; it's for Owners and Admins.");

h1("8. Team management (Owners & Admins)");
p("Open Team to manage accounts.");
bullets([
  "Add member — create an account with a name, email, temporary password and role. Share those details with the person so they can sign in.",
  "Edit — update someone's details or role, or deactivate an account so they can no longer sign in.",
  "Owners can manage anyone; Admins can manage Worker accounts.",
]);

h1("9. Your profile");
p("Open Profile (bottom-left menu) to:");
bullets([
  "Update your name, department and phone.",
  "Upload a profile photo using the Upload photo button.",
  "Change your password under the Security section.",
]);

h1("10. Email notifications");
p("The platform emails you about things that need your attention, for example:");
bullets([
  "When you're added to a task.",
  "When work you're reviewing is submitted, or your work is completed/approved.",
  "When you're invited to a meeting.",
]);
p("Each email includes a button that takes you straight to the relevant page.");

h1("Quick tips");
bullets([
  "A task stays Pending until the assignee accepts it — accept yours promptly.",
  "Keep progress updated so managers can see status without asking.",
  "Use comments and replies to keep all discussion attached to the task.",
  "Change your temporary password from Profile after your first sign-in.",
]);

doc.moveDown(2);
doc.fillColor(LIGHT).fontSize(9).text("SWM Platform — School Workforce Management · Staff user guide", {
  align: "center",
});

doc.end();
