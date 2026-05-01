const db = require("../db");
const { transporter } = require("../utils/mailer");
const crypto = require("crypto");

/**
 * GET /team - Show team members list + invite form
 */
async function showTeam(req, res, next) {
  try {
    const user = req.currentUser;
    if (!user) return res.redirect("/login");
    const companyId = user.company_id;

    // 1. Fetch current team members
    const membersQuery = `
      SELECT u.id, u.email, u.phone, u.timezone, r.role, r.created_at, u.is_active
      FROM users u
      JOIN roles r ON r.user_id = u.id
      WHERE u.company_id = $1
      ORDER BY r.created_at ASC
    `;
    const membersResult = await db.query(membersQuery, [companyId]);

    // 2. Fetch pending invites
    const invitesQuery = `
      SELECT id, email_id, created_at 
      FROM invites 
      WHERE company_id = $1
    `;
    const invitesResult = await db.query(invitesQuery, [companyId]);

    // 3. Fetch plan info
    const planResult = await db.query(`
      SELECT p.max_users 
      FROM companies c 
      JOIN plans p ON p.id = c.plan_id 
      WHERE c.id = $1
    `, [companyId]);
    const maxUsers = planResult.rows[0] ? planResult.rows[0].max_users : 5;

    // 4. Fetch available timezones and countries (for edit modal)
    // We can reuse the list from authController or just hardcode common ones
    const timezones = [
      "Pacific/Honolulu", "America/Anchorage", "America/Los_Angeles", "America/Denver",
      "America/Chicago", "America/New_York", "America/Sao_Paulo", "UTC",
      "Europe/London", "Europe/Paris", "Europe/Berlin", "Europe/Moscow",
      "Africa/Lagos", "Africa/Johannesburg", "Asia/Dubai", "Asia/Karachi",
      "Asia/Kolkata", "Asia/Bangkok", "Asia/Singapore", "Asia/Hong_Kong",
      "Asia/Tokyo", "Australia/Sydney", "Pacific/Auckland"
    ];

    // 5. Calculate used slots (excluding admin)
    const nonAdminCount = membersResult.rows.filter(m => m.role !== 'admin').length;
    const pendingCount = invitesResult.rows.length;
    const totalUsedSlots = nonAdminCount + pendingCount;

    return res.render("team", {
      title: "Team Management",
      members: membersResult.rows,
      pendingInvites: invitesResult.rows,
      currentUser: req.currentUser,
      maxUsers,
      totalUsedSlots,
      timezones
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * POST /team/invite - Send invitation email
 */
async function sendInvite(req, res, next) {
  const { email } = req.body;
  const user = req.currentUser;
  if (!user) return res.redirect("/login");
  const companyId = user.company_id;

  try {
    // 1. Validate email
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailPattern.test(email)) {
      req.flash("error", "A valid email is required.");
      return res.redirect("/team");
    }

    // 2. Check if user already in team
    const userCheck = await db.query("SELECT id FROM users WHERE email = $1 AND company_id = $2", [email, companyId]);
    if (userCheck.rows[0]) {
      req.flash("error", "User already exists in your team");
      return res.redirect("/team");
    }

    // 3. Check if invite already pending
    const inviteCheck = await db.query("SELECT id FROM invites WHERE email_id = $1 AND company_id = $2", [email, companyId]);
    if (inviteCheck.rows[0]) {
      req.flash("error", "Invite already sent to this email");
      return res.redirect("/team");
    }

    // 4. Check plan limit
    const companyInfoQuery = await db.query(`
      SELECT c.name as company_name, p.max_users 
      FROM companies c 
      JOIN plans p ON p.id = c.plan_id 
      WHERE c.id = $1
    `, [companyId]);
    
    const companyInfo = companyInfoQuery.rows[0];
    const maxUsers = companyInfo ? companyInfo.max_users : 5; // Default to 5 if something is wrong
    const companyName = companyInfo ? companyInfo.company_name : "your team";

    const currentUsersCountRes = await db.query("SELECT COUNT(*) FROM users WHERE company_id = $1 AND role != 'admin'", [companyId]);
    const pendingInvitesCountRes = await db.query("SELECT COUNT(*) FROM invites WHERE company_id = $1", [companyId]);
    
    const totalCount = parseInt(currentUsersCountRes.rows[0].count) + parseInt(pendingInvitesCountRes.rows[0].count);

    if (totalCount >= maxUsers) {
      req.flash("error", `Your plan limit (${maxUsers} users) has been reached. Please upgrade your plan.`);
      return res.redirect("/team");
    }

    // 5. Generate invitation ID
    const inviteId = crypto.randomUUID();

    // 6. Insert into invites
    await db.query("INSERT INTO invites (id, email_id, company_id) VALUES ($1, $2, $3)", [inviteId, email, companyId]);

    // 7. Send email
    try {
      const link = `${process.env.BASE_URL}/invite/${inviteId}/${companyId}`;
      await transporter.sendMail({
        from: process.env.SMTP_USER,
        to: email,
        subject: `You're invited to join ${companyName} on CrmOne`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Team Invitation</title>
            <style>
              body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc; margin: 0; padding: 0; -webkit-font-smoothing: antialiased; }
              .wrapper { width: 100%; table-layout: fixed; background-color: #f8fafc; padding: 40px 0; }
              .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); }
              .header { background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); padding: 40px 30px; text-align: center; }
              .logo { color: #ffffff; font-size: 28px; font-weight: 800; letter-spacing: -0.025em; text-decoration: none; }
              .content { padding: 48px 40px; text-align: center; }
              .greeting { font-size: 24px; font-weight: 700; color: #1e293b; margin: 0 0 16px 0; }
              .message { font-size: 16px; line-height: 1.6; color: #64748b; margin: 0 0 32px 0; }
              .company-badge { display: inline-block; padding: 6px 16px; background-color: #eff6ff; color: #2563eb; border-radius: 9999px; font-weight: 600; font-size: 14px; margin-bottom: 24px; }
              .cta-button { display: inline-block; background-color: #2563eb; color: #ffffff !important; font-size: 16px; font-weight: 600; text-decoration: none; padding: 16px 36px; border-radius: 14px; transition: all 0.2s ease; }
              .link-fallback { font-size: 12px; color: #94a3b8; margin-top: 32px; word-break: break-all; }
              .footer { padding: 32px 40px; text-align: center; font-size: 14px; color: #94a3b8; background-color: #fcfcfc; border-top: 1px solid #f1f5f9; }
              .footer a { color: #64748b; text-decoration: underline; }
            </style>
          </head>
          <body>
            <div class="wrapper">
              <div class="container">
                <div class="header">
                  <a href="#" class="logo">CrmOne</a>
                </div>
                <div class="content">
                  <div class="company-badge">${companyName}</div>
                  <h1 class="greeting">You're Invited!</h1>
                  <p class="message">
                    Hello!<br>
                    You've been invited to join the <strong>${companyName}</strong> team on CrmOne. 
                    Collaborate with your colleagues and manage your CRM more effectively than ever.
                  </p>
                  <a href="${link}" class="cta-button">Join Your Team</a>
                  <p class="link-fallback">
                    Button not working? Copy and paste this link:<br>
                    <a href="${link}" style="color: #2563eb;">${link}</a>
                  </p>
                </div>
                <div class="footer">
                  <p>&copy; 2026 CrmOne Inc. All rights reserved.</p>
                  <p>
                    <a href="#">Privacy Policy</a> &bull; <a href="#">Terms of Service</a> &bull; <a href="#">Help Center</a>
                  </p>
                </div>
              </div>
            </div>
          </body>
          </html>
        `
      });
      req.flash("success", `Invitation sent to ${email}`);
    } catch (mailError) {
      console.error("Email sending failed:", mailError);
      req.flash("error", "Invite record created but email failed to send. Please verify your SMTP settings in .env.");
    }
    
    return res.redirect("/team");
  } catch (error) {
    return next(error);
  }
}

/**
 * GET /invite/:id/:companyId - Accept Invite Link
 */
async function acceptInvite(req, res, next) {
  const { id, companyId } = req.params;

  try {
    const result = await db.query("SELECT * FROM invites WHERE id = $1 AND company_id = $2", [id, companyId]);
    if (!result.rows[0]) {
      return res.status(404).send("This invitation link is invalid or has expired.");
    }

    const row = result.rows[0];
    return res.redirect(`/signup?invite=true&invitationId=${id}&companyId=${companyId}&email=${row.email_id}`);
  } catch (error) {
    return next(error);
  }
}

/**
 * POST /team/invite/revoke - Revoke invitation
 */
async function revokeInvite(req, res, next) {
  const { id } = req.body;
  const user = req.currentUser;
  if (!user) return res.redirect("/login");
  const companyId = user.company_id;

  try {
    await db.query("DELETE FROM invites WHERE id = $1 AND company_id = $2", [id, companyId]);
    req.flash("success", "Invitation revoked");
    return res.redirect("/team");
  } catch (error) {
    return next(error);
  }
}

/**
 * POST /team/member/update - Update team member
 */
async function updateMember(req, res, next) {
  const { id, phone, timezone, role } = req.body;
  const admin = req.currentUser;
  if (!admin || admin.role !== 'admin') return res.redirect("/login");
  const companyId = admin.company_id;

  try {
    // Ensure member belongs to same company
    const check = await db.query("SELECT id FROM users WHERE id = $1 AND company_id = $2", [id, companyId]);
    if (!check.rows[0]) {
      req.flash("error", "Member not found");
      return res.redirect("/team");
    }

    await db.query("UPDATE users SET phone = $1, timezone = $2, role = $3 WHERE id = $4", [phone, timezone, role, id]);
    await db.query("UPDATE roles SET role = $1 WHERE user_id = $2", [role, id]);

    req.flash("success", "Member updated successfully");
    return res.redirect("/team");
  } catch (error) {
    return next(error);
  }
}

/**
 * POST /team/member/remove - Remove member
 */
async function removeMember(req, res, next) {
  const { id } = req.body;
  const admin = req.currentUser;
  if (!admin || admin.role !== 'admin') return res.redirect("/login");
  const companyId = admin.company_id;

  try {
    if (admin.id === id) {
      req.flash("error", "You cannot remove yourself");
      return res.redirect("/team");
    }

    const check = await db.query("SELECT id FROM users WHERE id = $1 AND company_id = $2", [id, companyId]);
    if (!check.rows[0]) {
      req.flash("error", "Member not found");
      return res.redirect("/team");
    }

    await db.query("DELETE FROM roles WHERE user_id = $1", [id]);
    await db.query("DELETE FROM users WHERE id = $1", [id]);

    req.flash("success", "Member removed from team");
    return res.redirect("/team");
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  showTeam,
  sendInvite,
  acceptInvite,
  revokeInvite,
  updateMember,
  removeMember
};
