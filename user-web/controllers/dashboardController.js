const db = require("../db");

function formatMemberName(email) {
  if (!email) return "Unassigned";
  const [localPart] = String(email).split("@");
  return localPart
    .split(/[._-]+/)
    .filter(Boolean)
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(" ");
}

function formatInitials(email) {
  const label = formatMemberName(email);
  const parts = label.split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join("") || "NA";
}

async function showDashboard(req, res, next) {
  try {
    const companyId = req.currentUser.company_id;

    const followupSelect = `
      SELECT
        f.id, f.title, f.description, f.followup_at, f.status,
        assignee.email AS assigned_to_email
      FROM followups f
      LEFT JOIN users assignee ON assignee.id = f.assigned_to
      WHERE f.company_id = $1
    `;

    const upcomingResult = await db.query(
      `${followupSelect} AND f.status = 'open' AND f.followup_at >= NOW() ORDER BY f.followup_at ASC LIMIT 5`,
      [companyId]
    );

    const pastResult = await db.query(
      `${followupSelect} AND (f.status != 'open' OR f.followup_at < NOW()) ORDER BY f.followup_at DESC LIMIT 5`,
      [companyId]
    );

    const formatFollowup = (row) => ({
      ...row,
      followup_at_label: new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }).format(new Date(row.followup_at)),
      followup_time_label: new Intl.DateTimeFormat("en-US", {
        hour: "numeric",
        minute: "2-digit",
      }).format(new Date(row.followup_at)),
      assignee_name: formatMemberName(row.assigned_to_email),
      assignee_initials: formatInitials(row.assigned_to_email),
    });

    return res.render("dashboard", {
      title: "CrmOne Dashboard",
      user: req.session.user || req.currentUser,
      currentUser: req.currentUser,
      currentPage: "dashboard",
      upcomingFollowups: upcomingResult.rows.map(formatFollowup),
      pastFollowups: pastResult.rows.map(formatFollowup),
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  showDashboard,
};
