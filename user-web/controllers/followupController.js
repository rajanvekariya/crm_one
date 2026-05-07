const db = require("../db");

function formatDateTimeLocal(value) {
  if (!value) return "";
  const date = new Date(value);
  const offsetMs = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function formatDateInput(value) {
  return formatDateTimeLocal(value).slice(0, 10);
}

function formatTimeInput(value) {
  return formatDateTimeLocal(value).slice(11, 16);
}

function isSameDay(left, right) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function formatTimelineDayLabel(value) {
  const date = new Date(value);
  const now = new Date();
  if (isSameDay(date, now)) {
    return "Today";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: date.getFullYear() === now.getFullYear() ? undefined : "numeric",
  }).format(date);
}

function formatTimeLabel(value) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatFullDateLabel(value) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

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

function parseWhatsAppImagesInput(rawValue) {
  const source = Array.isArray(rawValue) ? rawValue : String(rawValue || "").split(/\r?\n/);
  return [...new Set(source.map((value) => String(value).trim()).filter(Boolean))].slice(0, 12);
}

function normalizeStatusInput(rawStatus) {
  const value = String(rawStatus || "schedule_next_followup").trim();

  if (value === "schedule_next_followup" || value === "open") {
    return "open";
  }

  if (value === "followup_not_needed" || value === "completed") {
    return "completed";
  }

  if (value === "cancelled") {
    return "cancelled";
  }

  return null;
}

function mapStoredStatusToUi(status) {
  if (status === "completed") return "followup_not_needed";
  if (status === "cancelled") return "cancelled";
  return "schedule_next_followup";
}

function mapStoredStatusToLabel(status) {
  if (status === "completed") return "Followup not needed";
  if (status === "cancelled") return "Cancelled";
  return "Scheduled";
}

function deriveTitle(description, title) {
  const source = String(title || description || "Follow-up").trim();
  return source.slice(0, 255);
}

function parseFollowupAt(dateValue, timeValue) {
  const date = String(dateValue || "").trim();
  const time = String(timeValue || "").trim() || "00:00";

  if (!date) {
    return null;
  }

  const parsed = new Date(`${date}T${time}`);
  if (Number.isNaN(parsed.getTime())) {
    return "invalid";
  }

  return parsed;
}

function buildFollowupViewModel(row) {
  const whatsappImages = parseWhatsAppImagesInput(row.whatsapp_images);

  return {
    ...row,
    description: row.description || "",
    followup_at_local: formatDateTimeLocal(row.followup_at),
    followup_date: formatDateInput(row.followup_at),
    followup_time: formatTimeInput(row.followup_at),
    followup_day_label: formatTimelineDayLabel(row.followup_at),
    followup_time_label: formatTimeLabel(row.followup_at),
    followup_full_label: formatFullDateLabel(row.followup_at),
    assignee_name: formatMemberName(row.assigned_to_email),
    assignee_initials: formatInitials(row.assigned_to_email),
    status_ui_value: mapStoredStatusToUi(row.status),
    status_label: mapStoredStatusToLabel(row.status),
    status_class:
      row.status === "completed"
        ? "is-done"
        : row.status === "cancelled"
          ? "is-muted"
          : "is-open",
    whatsapp_images: whatsappImages,
    whatsapp_images_text: whatsappImages.join("\n"),
    closure_reason: row.closure_reason || "",
    closure_notes: row.closure_notes || "",
  };
}

async function loadFollowupPageData(user) {
  const companyId = user.company_id;
  const baseParams = [companyId];

  const followupSelect = `
    SELECT
      f.id,
      f.title,
      f.description,
      f.followup_at,
      f.status,
      f.is_notification_read,
      f.whatsapp_images,
      f.closure_reason,
      f.closure_notes,
      f.created_at,
      f.updated_at,
      creator.email AS created_by_email,
      assignee.email AS assigned_to_email,
      assignee.id AS assigned_to_id,
      assignee.role AS assigned_to_role
    FROM followups f
    LEFT JOIN users creator ON creator.id = f.created_by
    LEFT JOIN users assignee ON assignee.id = f.assigned_to
  `;

  const upcomingPromise = db.query(
    `
      ${followupSelect}
      WHERE f.company_id = $1
        AND f.status != 'cancelled'
        AND f.followup_at >= NOW()
      ORDER BY f.followup_at ASC
    `,
    baseParams
  );

  const pastPromise = db.query(
    `
      ${followupSelect}
      WHERE f.company_id = $1
        AND (f.followup_at < NOW() OR f.status IN ('completed', 'cancelled'))
      ORDER BY f.followup_at DESC
    `,
    baseParams
  );

  const teamMembersPromise = db.query(
    `
      SELECT id, email, role
      FROM users
      WHERE company_id = $1
        AND is_active = true
      ORDER BY email ASC
    `,
    baseParams
  );

  const [upcomingResult, pastResult, teamMembersResult] = await Promise.all([
    upcomingPromise,
    pastPromise,
    teamMembersPromise,
  ]);

  return {
    upcoming: upcomingResult.rows.map(buildFollowupViewModel),
    past: pastResult.rows.map(buildFollowupViewModel),
    teamMembers: teamMembersResult.rows.map((member) => ({
      ...member,
      display_name: formatMemberName(member.email),
      initials: formatInitials(member.email),
    })),
  };
}

function validateFollowupInput(body) {
  const description = String(body.description || "").trim();
  const assignedTo = String(body.assigned_to || "").trim() || null;
  const status = normalizeStatusInput(body.status);
  const closureReason = String(body.closure_reason || "").trim();
  const closureNotes = String(body.closure_notes || "").trim();
  const whatsappImages = parseWhatsAppImagesInput(body.whatsapp_images);

  if (!description) {
    return { error: "Description is required." };
  }

  if (!status) {
    return { error: "Invalid follow-up status." };
  }

  let followupAt = parseFollowupAt(body.followup_date, body.followup_time);

  if (followupAt === "invalid") {
    return { error: "Please provide a valid follow-up date and time." };
  }

  if (!followupAt && body.existing_followup_at) {
    const parsedExisting = new Date(body.existing_followup_at);
    if (!Number.isNaN(parsedExisting.getTime())) {
      followupAt = parsedExisting;
    }
  }

  if (!followupAt && status === "open") {
    return { error: "Next follow-up date and time is required." };
  }

  if (!followupAt) {
    followupAt = new Date();
  }

  return {
    data: {
      title: deriveTitle(description, body.title),
      description,
      followupAt,
      assignedTo,
      status,
      whatsappImages,
      closureReason,
      closureNotes,
    },
  };
}

async function assertMemberBelongsToCompany(companyId, userId) {
  if (!userId) return true;

  const result = await db.query(
    `
      SELECT 1
      FROM users
      WHERE id = $1
        AND company_id = $2
      LIMIT 1
    `,
    [userId, companyId]
  );

  return Boolean(result.rows[0]);
}

async function listPage(req, res, next) {
  try {
    const payload = await loadFollowupPageData(req.currentUser);
    const followupRecords = [...payload.upcoming, ...payload.past];

    return res.render("followup", {
      title: "Follow-Up",
      user: req.session.user || req.currentUser,
      currentUser: req.currentUser,
      currentPage: "followup",
      upcoming: payload.upcoming,
      past: payload.past,
      teamMembers: payload.teamMembers,
      followupRecordsJson: JSON.stringify(followupRecords).replace(/</g, "\\u003c"),
    });
  } catch (error) {
    return next(error);
  }
}

async function createFollowup(req, res, next) {
  try {
    const validation = validateFollowupInput(req.body);
    if (validation.error) {
      req.flash("error", validation.error);
      return res.redirect("/followup");
    }

    const {
      title,
      description,
      followupAt,
      assignedTo,
      status,
      whatsappImages,
      closureReason,
      closureNotes,
    } = validation.data;
    const companyId = req.currentUser.company_id;

    if (!(await assertMemberBelongsToCompany(companyId, assignedTo))) {
      req.flash("error", "Assigned team member was not found.");
      return res.redirect("/followup");
    }

    await db.query(
      `
        INSERT INTO followups (
          company_id,
          created_by,
          assigned_to,
          title,
          description,
          followup_at,
          status,
          whatsapp_images,
          closure_reason,
          closure_notes
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `,
      [
        companyId,
        req.currentUser.id,
        assignedTo,
        title,
        description,
        followupAt,
        status,
        whatsappImages,
        closureReason,
        closureNotes,
      ]
    );

    req.flash("success", "Follow-up created successfully.");
    return res.redirect("/followup");
  } catch (error) {
    return next(error);
  }
}

async function getUnreadCount(req, res, next) {
  try {
    const result = await db.query(
      `
        SELECT COUNT(*)::int AS count
        FROM followups
        WHERE company_id = $1
          AND assigned_to = $2
          AND is_notification_read = false
          AND followup_at <= NOW()
          AND status = 'open'
      `,
      [req.currentUser.company_id, req.currentUser.id]
    );

    return res.json({ count: result.rows[0]?.count || 0 });
  } catch (error) {
    return next(error);
  }
}

async function markAllRead(req, res, next) {
  try {
    await db.query(
      `
        UPDATE followups
        SET is_notification_read = true,
            updated_at = NOW()
        WHERE company_id = $1
          AND assigned_to = $2
          AND is_notification_read = false
      `,
      [req.currentUser.company_id, req.currentUser.id]
    );

    return res.json({ ok: true });
  } catch (error) {
    return next(error);
  }
}

async function getFollowupById(req, res, next) {
  try {
    const result = await db.query(
      `
        SELECT
          f.*,
          creator.email AS created_by_email,
          assignee.email AS assigned_to_email,
          assignee.role AS assigned_to_role
        FROM followups f
        LEFT JOIN users creator ON creator.id = f.created_by
        LEFT JOIN users assignee ON assignee.id = f.assigned_to
        WHERE f.id = $1
          AND f.company_id = $2
        LIMIT 1
      `,
      [req.params.id, req.currentUser.company_id]
    );

    if (!result.rows[0]) {
      return res.status(404).json({ error: "Follow-up not found." });
    }

    return res.json(buildFollowupViewModel(result.rows[0]));
  } catch (error) {
    return next(error);
  }
}

async function updateFollowup(req, res, next) {
  try {
    const validation = validateFollowupInput(req.body);
    if (validation.error) {
      req.flash("error", validation.error);
      return res.redirect("/followup");
    }

    const {
      title,
      description,
      followupAt,
      assignedTo,
      status,
      whatsappImages,
      closureReason,
      closureNotes,
    } = validation.data;

    const companyId = req.currentUser?.company_id;
    if (!companyId) {
      req.flash("error", "Your session has expired. Please log in again.");
      return res.redirect("/login");
    }

    if (assignedTo && !(await assertMemberBelongsToCompany(companyId, assignedTo))) {
      req.flash("error", "Assigned team member was not found.");
      return res.redirect("/followup");
    }

    const followupId = req.params.id;
    if (!followupId) {
      req.flash("error", "Follow-up ID is missing.");
      return res.redirect("/followup");
    }

    const result = await db.query(
      `
        UPDATE followups
        SET assigned_to = $1,
            title = $2,
            description = $3,
            followup_at = $4,
            status = $5,
            whatsapp_images = $6,
            closure_reason = $7,
            closure_notes = $8,
            is_notification_read = CASE
              WHEN $4::timestamp > NOW() THEN false
              ELSE is_notification_read
            END,
            updated_at = NOW()
        WHERE id = $9::uuid
          AND company_id = $10::uuid
        RETURNING id
      `,
      [
        assignedTo,
        title,
        description,
        followupAt,
        status,
        whatsappImages,
        closureReason,
        closureNotes,
        followupId,
        companyId,
      ]
    );

    if (!result.rows[0]) {
      req.flash("error", "Follow-up not found.");
      return res.redirect("/followup");
    }

    req.flash("success", "Follow-up updated successfully.");
    return res.redirect("/followup");
  } catch (error) {
    console.error("Update Followup Error:", error);
    return next(error);
  }
}

async function deleteFollowup(req, res, next) {
  try {
    const result = await db.query(
      `
        DELETE FROM followups
        WHERE id = $1
          AND company_id = $2
        RETURNING id
      `,
      [req.params.id, req.currentUser.company_id]
    );

    if (!result.rows[0]) {
      req.flash("error", "Follow-up not found.");
      return res.redirect("/followup");
    }

    req.flash("success", "Follow-up deleted successfully.");
    return res.redirect("/followup");
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  listPage,
  createFollowup,
  getUnreadCount,
  markAllRead,
  getFollowupById,
  updateFollowup,
  deleteFollowup,
};
