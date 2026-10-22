
export const taskAssignedTemplate = ({
  memberName,
  taskTitle,
  taskDescription,
  startDate,
  dueDate,
  priority,
  assignedBy,
}) => {
  const escapeHtml = (value = "") =>
    String(value).replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    })[char]);

  const safe = (value, fallback = "Not specified") =>
    escapeHtml(value ?? fallback);

  const formatDate = (date) => {
    if (!date) return "Not specified";

    const parsed = new Date(date);

    if (Number.isNaN(parsed.getTime())) {
      return "Not specified";
    }

    return parsed.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "UTC",
    });
  };

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Task Assigned - TaskVerse</title>
</head>

<body style="
  margin: 0;
  padding: 0;
  background-color: #f4f7fb;
  font-family: Arial, Helvetica, sans-serif;
">

  <div style="width: 100%; padding: 40px 0;">

    <div style="
      max-width: 520px;
      margin: auto;
      background-color: #ffffff;
      border-radius: 16px;
      padding: 40px 30px;
      text-align: center;
      box-shadow: 0 8px 30px rgba(0, 0, 0, 0.08);
      box-sizing: border-box;
    ">

      <!-- Logo -->
      <div style="
        font-size: 32px;
        font-weight: bold;
        color: #6c63ff;
        margin-bottom: 25px;
      ">
        TaskVerse
      </div>

      <!-- Title -->
      <h1 style="
        margin: 0 0 15px;
        color: #222222;
        font-size: 26px;
      ">
        New Task Assigned!
      </h1>

      <!-- Greeting -->
      <p style="
        margin: 0 auto 25px;
        color: #666666;
        font-size: 16px;
        line-height: 1.7;
      ">
        Hello ${safe(memberName, "there")}, a new task has been assigned
        to you. Here are the details.
      </p>

      <!-- Task Details -->
      <div style="
        background-color: #f0efff;
        border: 2px solid #6c63ff;
        border-radius: 12px;
        padding: 22px 20px;
        margin-bottom: 25px;
        text-align: left;
      ">

        <p style="
          margin: 0 0 8px;
          color: #6c63ff;
          font-size: 12px;
          font-weight: bold;
          letter-spacing: 1px;
          text-transform: uppercase;
        ">
          TASK DETAILS
        </p>

        <h2 style="
          margin: 0 0 15px;
          color: #29264a;
          font-size: 21px;
          line-height: 1.5;
          overflow-wrap: anywhere;
        ">
          ${safe(taskTitle, "Untitled Task")}
        </h2>

        <p style="
          margin: 0 0 20px;
          color: #666666;
          font-size: 14px;
          line-height: 1.7;
          overflow-wrap: anywhere;
        ">
          ${safe(taskDescription, "No description provided.")}
        </p>

        <div style="
          border-top: 1px solid #dcd9ff;
          padding-top: 15px;
        ">

          <p style="margin: 0 0 12px; color: #555555; font-size: 14px;">
            <strong style="color: #333333;">Start Date:</strong>
            ${formatDate(startDate)}
          </p>

          <p style="margin: 0 0 12px; color: #555555; font-size: 14px;">
            <strong style="color: #333333;">Due Date:</strong>
            ${formatDate(dueDate)}
          </p>

          <p style="margin: 0 0 12px; color: #555555; font-size: 14px;">
            <strong style="color: #333333;">Priority:</strong>
            ${safe(priority, "Medium")}
          </p>

          <p style="margin: 0; color: #555555; font-size: 14px;">
            <strong style="color: #333333;">Assigned By:</strong>
            ${safe(assignedBy, "Administrator")}
          </p>

        </div>
      </div>

      <!-- Reminder -->
      <p style="
        margin: 0 auto 25px;
        color: #777777;
        font-size: 14px;
        line-height: 1.7;
      ">
        Log in to TaskVerse to review your task and get started.
      </p>

      <!-- Footer -->
      <div style="
        padding-top: 20px;
        border-top: 1px solid #eeeeee;
      ">

        <p style="
          margin: 0 0 8px;
          color: #999999;
          font-size: 13px;
          line-height: 1.6;
        ">
          This is an automated notification. Please do not reply.
        </p>

        <p style="
          margin: 0;
          color: #aaaaaa;
          font-size: 12px;
        ">
          © ${new Date().getFullYear()} TaskVerse. All rights reserved.
        </p>

      </div>

    </div>
  </div>

</body>
</html>
`;
};
