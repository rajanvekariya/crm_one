const db = require("../db");

async function listCompanies(req, res, next) {
  try {
    const query = `
      SELECT 
        c.id, 
        c.name, 
        p.name as plan_name, 
        c.billing_cycle, 
        c.plan_start_date, 
        c.plan_end_date, 
        c.created_at,
        (SELECT COUNT(*) FROM users WHERE company_id = c.id) as user_count
      FROM companies c
      LEFT JOIN plans p ON p.id = c.plan_id
      ORDER BY c.created_at DESC
    `;
    const result = await db.query(query);
    return res.render("companies", {
      title: "Registered Companies",
      companies: result.rows,
      currentAdmin: req.session.admin
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  listCompanies
};
