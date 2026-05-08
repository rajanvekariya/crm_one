const db = require("../db");

const TASK_TYPES = ["ToDo", "Email", "Call", "Meeting"];
const TASK_PRIORITIES = ["Low", "Medium", "High"];
const TASK_STATUSES = ["Not Started", "In Progress", "Waiting", "Completed", "Deferred"];

const BASE_QUERY = `
  SELECT
    t.*,
    u1.email AS assigned_to_email,
    u2.email AS assigned_by_email,
    u3.email AS created_by_email
  FROM tasks t
  LEFT JOIN users u1 ON u1.id = t.assigned_to
  LEFT JOIN users u2 ON u2.id = t.assigned_by
  LEFT JOIN users u3 ON u3.id = t.created_by
  WHERE t.company_id = $1
`;

function formatDateInput(value) {
  if (!value) return "";

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return trimmed;
    }
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function formatTimeInput(value) {
  if (!value) return "";

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (/^\d{2}:\d{2}(:\d{2})?$/.test(trimmed)) {
      return trimmed.slice(0, 5);
    }
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(11, 16);
}

function formatDateLabel(value) {
  const normalized = formatDateInput(value);
  if (!normalized) return "—";

  const date = new Date(`${normalized}T00:00:00Z`);
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function formatTimeLabel(value) {
  const normalized = formatTimeInput(value);
  if (!normalized) return "—";

  const date = new Date(`1970-01-01T${normalized}:00`);
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatDateTimeLabel(value) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function normalizeUuid(value) {
  const normalized = String(value || "").trim();
  if (!normalized) return null;

  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(normalized)
    ? normalized
    : null;
}

function normalizeDateValue(value) {
  const normalized = String(value || "").trim();
  if (!normalized) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : "invalid";
}

function normalizeTimeValue(value) {
  const normalized = String(value || "").trim();
  if (!normalized) return null;
  return /^\d{2}:\d{2}(:\d{2})?$/.test(normalized) ? normalized.slice(0, 5) : "invalid";
}

function normalizeEnum(value, allowed, fallback) {
  const normalized = String(value || "").trim();
  if (!normalized) return fallback;
  return allowed.includes(normalized) ? normalized : null;
}

function buildTaskViewModel(row) {
  return {
    ...row,
    description: row.description || "",
    tag: row.tag || "",
    due_date: formatDateInput(row.due_date),
    due_time: formatTimeInput(row.due_time),
    due_date_label: formatDateLabel(row.due_date),
    due_time_label: formatTimeLabel(row.due_time),
    created_at_label: formatDateTimeLabel(row.created_at),
    updated_at_label: formatDateTimeLabel(row.updated_at),
  };
}

function buildCommentViewModel(row) {
  return {
    ...row,
    created_at_label: formatDateTimeLabel(row.created_at),
  };
}

function buildAttachmentViewModel(row) {
  return {
    ...row,
    created_at_label: formatDateTimeLabel(row.created_at),
  };
}

function groupTasksByStatus(tasks) {
  return {
    notStarted: tasks.filter((task) => task.status === "Not Started"),
    inProgress: tasks.filter((task) => task.status === "In Progress"),
    waiting: tasks.filter((task) => task.status === "Waiting"),
    completed: tasks.filter((task) => task.status === "Completed"),
    deferred: tasks.filter((task) => task.status === "Deferred"),
  };
}

async function fetchTeamMembers(companyId) {
  const result = await db.query(
    `
      SELECT u.id, u.email
      FROM users u
      WHERE u.company_id = $1
        AND u.is_active = true
      ORDER BY u.email ASC
    `,
    [companyId]
  );

  return result.rows;
}

function normalizeTaskPayload(body) {
  const title = String(body.title || "").trim();
  const description = String(body.description || "").trim();
  const tag = String(body.tag || "").trim() || null;
  const dueDate = normalizeDateValue(body.due_date);
  const dueTime = normalizeTimeValue(body.due_time);
  const type = normalizeEnum(body.type, TASK_TYPES, "ToDo");
  const priority = normalizeEnum(body.priority, TASK_PRIORITIES, "Medium");
  const status = normalizeEnum(body.status, TASK_STATUSES, "Not Started");
  const assignedTo = normalizeUuid(body.assigned_to);
  const assignedBy = normalizeUuid(body.assigned_by);

  if (!title) {
    return { error: "Task title is required." };
  }

  if (dueDate === "invalid") {
    return { error: "Please provide a valid due date." };
  }

  if (dueTime === "invalid") {
    return { error: "Please provide a valid due time." };
  }

  if (!type) {
    return { error: "Invalid task type selected." };
  }

  if (!priority) {
    return { error: "Invalid task priority selected." };
  }

  if (!status) {
    return { error: "Invalid task status selected." };
  }

  return {
    title,
    description,
    dueDate,
    dueTime,
    type,
    priority,
    status,
    tag,
    assignedTo,
    assignedBy,
  };
}

async function ensureTaskExists(taskId, companyId) {
  const result = await db.query(
    `${BASE_QUERY} AND t.id = $2 LIMIT 1`,
    [companyId, taskId]
  );

  return result.rows[0] ? buildTaskViewModel(result.rows[0]) : null;
}

async function listPage(req, res, next) {
  try {
    const companyId = req.currentUser.company_id;
    const [taskResult, teamMembers] = await Promise.all([
      db.query(`${BASE_QUERY} ORDER BY t.created_at DESC`, [companyId]),
      fetchTeamMembers(companyId),
    ]);

    const tasks = taskResult.rows.map(buildTaskViewModel);
    const grouped = groupTasksByStatus(tasks);

    return res.render("task", {
      currentPage: "task",
      user: req.session.user || req.currentUser,
      currentUser: req.currentUser,
      tasks,
      notStarted: grouped.notStarted,
      inProgress: grouped.inProgress,
      waiting: grouped.waiting,
      completed: grouped.completed,
      deferred: grouped.deferred,
      teamMembers,
      error: res.locals.errorMessages || [],
      success: res.locals.successMessages || [],
    });
  } catch (error) {
    return next(error);
  }
}

async function getTaskData(req, res, next) {
  try {
    const companyId = req.currentUser.company_id;
    console.log('[task:getTaskData] company=%s query=%o', companyId, req.query);
    const params = [companyId];
    const conditions = [];

    const search = String(req.query.search || "").trim();
    const priority = String(req.query.priority || "").trim();
    const status = String(req.query.status || "").trim();
    const type = String(req.query.type || "").trim();
    const tag = String(req.query.tag || "").trim();
    const dateFrom = normalizeDateValue(req.query.date_from);
    const dateTo = normalizeDateValue(req.query.date_to);
    const assignedToValues = String(req.query.assigned_to || "")
      .split(",")
      .map((value) => normalizeUuid(value))
      .filter(Boolean);

    if (dateFrom === "invalid" || dateTo === "invalid") {
      return res.status(400).json({ success: false, message: "Invalid date filter." });
    }

    if (search) {
      params.push(search);
      conditions.push(`t.title ILIKE '%' || $${params.length} || '%'`);
    }

    if (priority && TASK_PRIORITIES.includes(priority)) {
      params.push(priority);
      conditions.push(`t.priority = $${params.length}`);
    }

    if (status && TASK_STATUSES.includes(status)) {
      params.push(status);
      conditions.push(`t.status = $${params.length}`);
    }

    if (type && TASK_TYPES.includes(type)) {
      params.push(type);
      conditions.push(`t.type = $${params.length}`);
    }

    if (assignedToValues.length) {
      params.push(assignedToValues);
      conditions.push(`t.assigned_to = ANY($${params.length}::uuid[])`);
    }

    if (dateFrom) {
      params.push(dateFrom);
      conditions.push(`t.due_date >= $${params.length}::date`);
    }

    if (dateTo) {
      params.push(dateTo);
      conditions.push(`t.due_date <= $${params.length}::date`);
    }

    if (tag) {
      params.push(tag);
      conditions.push(`COALESCE(t.tag, '') ILIKE '%' || $${params.length} || '%'`);
    }

    const tab = String(req.query.tab || "all").trim();
    if (tab === "due_today") {
      conditions.push(`t.due_date = CURRENT_DATE`);
    } else if (tab === "overdue") {
      conditions.push(`t.due_date < CURRENT_DATE AND t.status != 'Completed'`);
    } else if (tab === "upcoming_due") {
      conditions.push(`t.due_date > CURRENT_DATE`);
    }

    const whereClause = conditions.length ? ` AND ${conditions.join(" AND ")}` : "";
    const result = await db.query(
      `${BASE_QUERY}${whereClause} ORDER BY t.created_at DESC`,
      params
    );

    return res.json(result.rows.map(buildTaskViewModel));
  } catch (error) {
    return next(error);
  }
}

async function createTask(req, res, next) {
  try {
    const companyId = req.currentUser.company_id;
    console.log('[task:create] company=%s user=%s body=%o', companyId, req.currentUser && req.currentUser.id, req.body);
    const payload = normalizeTaskPayload(req.body);

    if (payload.error) {
      req.flash("error", payload.error);
      return res.redirect("/task");
    }

    await db.query(
      `
        INSERT INTO tasks (
          company_id,
          title,
          description,
          due_date,
          due_time,
          type,
          priority,
          status,
          tag,
          assigned_to,
          assigned_by,
          created_by
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING id
      `,
      [
        companyId,
        payload.title,
        payload.description,
        payload.dueDate,
        payload.dueTime,
        payload.type,
        payload.priority,
        payload.status,
        payload.tag,
        payload.assignedTo,
        payload.assignedBy,
        req.currentUser.id,
      ]
    );

    req.flash("success", "Task created successfully");
    return res.redirect("/task");
  } catch (error) {
    return next(error);
  }
}

async function showTaskDetail(req, res, next) {
  try {
    const taskId = Number(req.params.id);
    if (!Number.isInteger(taskId)) {
      req.flash("error", "Task not found.");
      return res.redirect("/task");
    }

    const companyId = req.currentUser.company_id;
    const [task, commentsResult, attachmentsResult, teamMembers] = await Promise.all([
      ensureTaskExists(taskId, companyId),
      db.query(
        `
          SELECT tc.*, u.email
          FROM task_comments tc
          LEFT JOIN users u ON u.id = tc.user_id
          WHERE tc.task_id = $1
          ORDER BY tc.created_at ASC
        `,
        [taskId]
      ),
      db.query(
        `
          SELECT ta.*, u.email
          FROM task_attachments ta
          LEFT JOIN users u ON u.id = ta.user_id
          WHERE ta.task_id = $1
          ORDER BY ta.created_at ASC
        `,
        [taskId]
      ),
      fetchTeamMembers(companyId),
    ]);

    if (!task) {
      req.flash("error", "Task not found.");
      return res.redirect("/task");
    }

    return res.render("task-detail", {
      currentPage: "task",
      user: req.session.user || req.currentUser,
      currentUser: req.currentUser,
      task,
      comments: commentsResult.rows.map(buildCommentViewModel),
      attachments: attachmentsResult.rows.map(buildAttachmentViewModel),
      teamMembers,
      taskStatuses: TASK_STATUSES,
      taskPriorities: TASK_PRIORITIES,
      taskTypes: TASK_TYPES,
      error: res.locals.errorMessages || [],
      success: res.locals.successMessages || [],
    });
  } catch (error) {
    return next(error);
  }
}

async function updateTask(req, res, next) {
  try {
    const taskId = Number(req.params.id);
    if (!Number.isInteger(taskId)) {
      req.flash("error", "Task not found.");
      return res.redirect("/task");
    }

    const companyId = req.currentUser.company_id;
    const payload = normalizeTaskPayload(req.body);

    if (payload.error) {
      req.flash("error", payload.error);
      return res.redirect(`/task/${taskId}`);
    }

    const result = await db.query(
      `
        UPDATE tasks
        SET
          title = $1,
          description = $2,
          due_date = $3,
          due_time = $4,
          type = $5,
          priority = $6,
          status = $7,
          tag = $8,
          assigned_to = $9,
          assigned_by = $10,
          updated_at = NOW()
        WHERE id = $11
          AND company_id = $12
      `,
      [
        payload.title,
        payload.description,
        payload.dueDate,
        payload.dueTime,
        payload.type,
        payload.priority,
        payload.status,
        payload.tag,
        payload.assignedTo,
        payload.assignedBy,
        taskId,
        companyId,
      ]
    );

    if (!result.rowCount) {
      req.flash("error", "Task not found.");
      return res.redirect("/task");
    }

    req.flash("success", "Task updated");
    return res.redirect(`/task/${taskId}`);
  } catch (error) {
    return next(error);
  }
}

async function updateTaskStatus(req, res, next) {
  try {
    const taskId = Number(req.params.id);
    const status = normalizeEnum(req.body.status, TASK_STATUSES, null);

    if (!Number.isInteger(taskId) || !status) {
      return res.status(400).json({ success: false, message: "Invalid task status update." });
    }

    const result = await db.query(
      `
        UPDATE tasks
        SET status = $1, updated_at = NOW()
        WHERE id = $2
          AND company_id = $3
      `,
      [status, taskId, req.currentUser.company_id]
    );

    if (!result.rowCount) {
      return res.status(404).json({ success: false, message: "Task not found." });
    }

    return res.json({ success: true, status });
  } catch (error) {
    return next(error);
  }
}

async function deleteTask(req, res, next) {
  try {
    const taskId = Number(req.params.id);
    if (!Number.isInteger(taskId)) {
      req.flash("error", "Task not found.");
      return res.redirect("/task");
    }

    const result = await db.query(
      `
        DELETE FROM tasks
        WHERE id = $1
          AND company_id = $2
      `,
      [taskId, req.currentUser.company_id]
    );

    if (!result.rowCount) {
      if (req.headers.accept && req.headers.accept.includes("application/json")) {
        return res.status(404).json({ success: false, message: "Task not found." });
      }

      req.flash("error", "Task not found.");
      return res.redirect("/task");
    }

    if (req.headers.accept && req.headers.accept.includes("application/json")) {
      return res.json({ success: true });
    }

    req.flash("success", "Task deleted");
    return res.redirect("/task");
  } catch (error) {
    return next(error);
  }
}

async function addComment(req, res, next) {
  try {
    const taskId = Number(req.params.id);
    const comment = String(req.body.comment || "").trim();

    if (!Number.isInteger(taskId)) {
      req.flash("error", "Task not found.");
      return res.redirect("/task");
    }

    if (!comment) {
      req.flash("error", "Comment cannot be empty.");
      return res.redirect(`/task/${taskId}`);
    }

    const task = await ensureTaskExists(taskId, req.currentUser.company_id);
    if (!task) {
      req.flash("error", "Task not found.");
      return res.redirect("/task");
    }

    await db.query(
      `
        INSERT INTO task_comments (task_id, user_id, comment)
        VALUES ($1, $2, $3)
      `,
      [taskId, req.currentUser.id, comment]
    );

    req.flash("success", "Comment added.");
    return res.redirect(`/task/${taskId}`);
  } catch (error) {
    return next(error);
  }
}

async function addAttachment(req, res, next) {
  try {
    const taskId = Number(req.params.id);

    if (!Number.isInteger(taskId)) {
      req.flash("error", "Task not found.");
      return res.redirect("/task");
    }

    const task = await ensureTaskExists(taskId, req.currentUser.company_id);
    if (!task) {
      req.flash("error", "Task not found.");
      return res.redirect("/task");
    }

    if (!req.file) {
      req.flash("error", "Please choose a valid file to upload.");
      return res.redirect(`/task/${taskId}`);
    }

    await db.query(
      `
        INSERT INTO task_attachments (task_id, user_id, filename, filepath)
        VALUES ($1, $2, $3, $4)
      `,
      [taskId, req.currentUser.id, req.file.originalname, `/uploads/tasks/${req.file.filename}`]
    );

    req.flash("success", "Attachment uploaded.");
    return res.redirect(`/task/${taskId}`);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  BASE_QUERY,
  TASK_TYPES,
  TASK_PRIORITIES,
  TASK_STATUSES,
  listPage,
  getTaskData,
  createTask,
  showTaskDetail,
  updateTask,
  updateTaskStatus,
  deleteTask,
  addComment,
  addAttachment,
};
