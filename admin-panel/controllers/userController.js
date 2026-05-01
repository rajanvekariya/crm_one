const db = require("../db");

async function showDashboard(req, res, next) {
  try {
    const statsQuery = `
      SELECT
        COUNT(*)::int AS total_users,
        COUNT(*) FILTER (WHERE is_active = true)::int AS active_users,
        COUNT(*) FILTER (WHERE is_active = false)::int AS inactive_users
      FROM users
    `;

    const recentUsersQuery = `
      SELECT
        companies.name AS company_name,
        users.email,
        users.created_at,
        users.is_active,
        plans.name AS plan_name
      FROM users
      LEFT JOIN companies ON companies.id = users.company_id
      LEFT JOIN plans ON plans.id = companies.plan_id
      ORDER BY users.created_at DESC
      LIMIT 5
    `;

    const [statsResult, recentUsersResult] = await Promise.all([
      db.query(statsQuery),
      db.query(recentUsersQuery),
    ]);

    return res.render("dashboard", {
      title: "Admin Dashboard",
      stats: statsResult.rows[0],
      recentUsers: recentUsersResult.rows,
    });
  } catch (error) {
    return next(error);
  }
}

async function showUsers(req, res, next) {
  try {
    const query = `
      SELECT
        users.id,
        companies.name AS company_name,
        users.email,
        users.phone,
        users.country,
        companies.billing_cycle,
        companies.plan_start_date,
        companies.plan_end_date,
        users.is_active,
        users.role,
        users.created_at,
        plans.name AS plan_name
      FROM users
      LEFT JOIN companies ON companies.id = users.company_id
      LEFT JOIN plans ON plans.id = companies.plan_id
      ORDER BY users.created_at DESC
    `;

    const result = await db.query(query);

    return res.render("users", {
      title: "Manage Users",
      users: result.rows,
    });
  } catch (error) {
    return next(error);
  }
}

async function setUserStatus(req, res, next, status) {
  const { id } = req.params;
  try {
    const result = await db.query(
      "UPDATE users SET is_active = $1 WHERE id = $2 RETURNING email",
      [status, id]
    );

    if (!result.rows[0]) {
      req.flash("error", "User not found.");
      return res.redirect("/api/users");
    }

    req.flash(
      "success",
      `User ${result.rows[0].email} has been ${
        status ? "activated" : "deactivated"
      }.`
    );
    return res.redirect("/api/users");
  } catch (error) {
    return next(error);
  }
}

function activateUser(req, res, next) {
  return setUserStatus(req, res, next, true);
}

function deactivateUser(req, res, next) {
  return setUserStatus(req, res, next, false);
}

async function deleteUser(req, res, next) {
  const { id } = req.params;

  try {
    const result = await db.query(
      "DELETE FROM users WHERE id = $1 RETURNING email",
      [id]
    );

    if (!result.rows[0]) {
      req.flash("error", "User not found.");
      return res.redirect("/api/users");
    }

    req.flash("success", `User ${result.rows[0].email} has been deleted.`);
    return res.redirect("/api/users");
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  showDashboard,
  showUsers,
  activateUser,
  deactivateUser,
  deleteUser,
};
