const db = require("../db");

async function listPlans(req, res, next) {
  try {
    const result = await db.query("SELECT * FROM plans ORDER BY max_users ASC");
    return res.render("plans", {
      title: "Manage Plans",
      plans: result.rows,
      currentAdmin: req.session.admin
    });
  } catch (error) {
    return next(error);
  }
}

async function createPlan(req, res, next) {
  const { name, price_yearly, price_monthly, max_users, billing_cycle } = req.body;
  try {
    await db.query(
      "INSERT INTO plans (name, price_yearly, price_monthly, max_users, billing_cycle) VALUES ($1, $2, $3, $4, $5)",
      [name, price_yearly, price_monthly, max_users, billing_cycle]
    );
    req.flash("success", "Plan created successfully.");
    return res.redirect("/api/plans");
  } catch (error) {
    req.flash("error", "Error creating plan: " + error.message);
    return res.redirect("/api/plans");
  }
}

async function updatePlan(req, res, next) {
  const { id } = req.params;
  const { name, price_yearly, price_monthly, max_users, billing_cycle } = req.body;
  try {
    await db.query(
      "UPDATE plans SET name = $1, price_yearly = $2, price_monthly = $3, max_users = $4, billing_cycle = $5 WHERE id = $6",
      [name, price_yearly, price_monthly, max_users, billing_cycle, id]
    );
    req.flash("success", "Plan updated successfully.");
    return res.redirect("/api/plans");
  } catch (error) {
    req.flash("error", "Error updating plan: " + error.message);
    return res.redirect("/api/plans");
  }
}

async function deletePlan(req, res, next) {
  const { id } = req.params;
  try {
    await db.query("DELETE FROM plans WHERE id = $1", [id]);
    req.flash("success", "Plan deleted successfully.");
    return res.redirect("/api/plans");
  } catch (error) {
    req.flash("error", "Error deleting plan: " + error.message);
    return res.redirect("/api/plans");
  }
}

module.exports = {
  listPlans,
  createPlan,
  updatePlan,
  deletePlan
};
