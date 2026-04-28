const bcrypt = require("bcrypt");
const db = require("../db");

function showLogin(req, res) {
  if (req.session.admin) {
    return res.redirect("/api/dashboard");
  }

  return res.render("login", {
    title: "Admin Login",
    form: { email: "" },
  });
}

async function login(req, res) {
  const email = (req.body.email || "").trim().toLowerCase();
  const password = req.body.password || "";

  if (!email || !password) {
    return res.status(400).render("login", {
      title: "Admin Login",
      form: { email },
      manualError: "Email and password are required.",
    });
  }

  try {
    const result = await db.query(
      "SELECT id, email, password FROM admins WHERE email = $1",
      [email]
    );

    const admin = result.rows[0];

    if (!admin) {
      return res.status(401).render("login", {
        title: "Admin Login",
        form: { email },
        manualError: "Invalid email or password.",
      });
    }

    const isPasswordValid = await bcrypt.compare(password, admin.password);

    if (!isPasswordValid) {
      return res.status(401).render("login", {
        title: "Admin Login",
        form: { email },
        manualError: "Invalid email or password.",
      });
    }

    req.session.admin = {
      id: admin.id,
      email: admin.email,
      name: "CrmOne Admin",
    };

    return res.redirect("/api/dashboard");
  } catch (error) {
    console.error("Admin login failed:", error);
    return res.status(500).render("login", {
      title: "Admin Login",
      form: { email },
      manualError: "Unable to sign in right now. Please try again.",
    });
  }
}

function logout(req, res) {
  req.session.destroy(() => {
    res.redirect("/api/login");
  });
}

module.exports = {
  showLogin,
  login,
  logout,
};
