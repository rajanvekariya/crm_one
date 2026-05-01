const db = require("../db");

async function attachCurrentUser(req, res, next) {
  if (!req.session.userId) {
    res.locals.currentUser = null;
    return next();
  }

  try {
    const result = await db.query(
      `
        SELECT
          users.id,
          users.company_id,
          users.role,
          companies.name AS company_name,
          companies.plan_end_date,
          users.email,
          users.is_active,
          companies.billing_cycle,
          users.created_at,
          plans.name AS plan_name,
          plans.max_users
        FROM users
        LEFT JOIN companies ON companies.id = users.company_id
        LEFT JOIN plans ON plans.id = companies.plan_id
        WHERE users.id = $1
      `,
      [req.session.userId]
    );

    const user = result.rows[0] || null;

    if (!user) {
      req.session.userId = null;
      req.session.destroy(() => { });
      res.locals.currentUser = null;
      return next();
    }

    // Check for plan expiration
    if (user.plan_end_date && new Date(user.plan_end_date) < new Date()) {
      user.is_active = false; // Effectively deactivates the user session-wise
    }

    req.currentUser = user;
    res.locals.currentUser = user;
    return next();
  } catch (error) {
    return next(error);
  }
}

function isAuthenticated(req, res, next) {
  if (!req.session.userId) {
    req.flash("error", "Please log in to continue.");
    return res.redirect("/login");
  }

  return next();
}

function ensureActive(req, res, next) {
  if (!req.currentUser) {
    req.flash("error", "Please log in to continue.");
    return res.redirect("/login");
  }

  if (!req.currentUser.is_active) {
    return res.redirect("/activation-pending");
  }

  return next();
}

module.exports = {
  attachCurrentUser,
  isAuthenticated,
  ensureActive,
};
