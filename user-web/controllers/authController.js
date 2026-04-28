const bcrypt = require("bcrypt");
const db = require("../db");

const timezones = [
  "Asia/Calcutta",
  "Asia/Dubai",
  "Europe/London",
  "America/New_York",
  "Australia/Sydney",
];

async function fetchPlans() {
  const result = await db.query(
    "SELECT id, name, price_yearly, price_monthly, max_users FROM plans ORDER BY id ASC"
  );
  return result.rows;
}

function buildSignupModel(overrides = {}) {
  return {
    title: "Set Up Your CrmOne Account",
    countries: [
      "India (+91)",
      "United States (+1)",
      "United Kingdom (+44)",
      "Australia (+61)",
      "Singapore (+65)",
    ],
    timezones,
    plans: [],
    form: {
      company_name: "",
      email: "",
      phone: "",
      country: "India (+91)",
      timezone: "Asia/Calcutta",
      billing_cycle: "yearly",
      plan_id: "",
      ...overrides,
    },
    fieldErrors: [],
  };
}

async function showSignup(req, res, next) {
  try {
    if (req.currentUser && req.currentUser.is_active) {
      return res.redirect("/dashboard");
    }

    if (req.currentUser && !req.currentUser.is_active) {
      return res.redirect("/contact");
    }

    const viewModel = buildSignupModel();
    viewModel.plans = await fetchPlans();
    viewModel.form.plan_id = viewModel.plans[0] ? String(viewModel.plans[0].id) : "";
    return res.render("signup", viewModel);
  } catch (error) {
    return next(error);
  }
}

async function signup(req, res, next) {
  const {
    company_name = "",
    email = "",
    phone = "",
    country = "India (+91)",
    timezone = "Asia/Calcutta",
    password = "",
    confirm_password = "",
    billing_cycle = "yearly",
    plan_id = "",
  } = req.body;

  const form = {
    company_name: company_name.trim(),
    email: email.trim().toLowerCase(),
    phone: phone.trim(),
    country,
    timezone,
    billing_cycle,
    plan_id: String(plan_id),
  };

  try {
    const viewModel = buildSignupModel(form);
    viewModel.plans = await fetchPlans();

    const fieldErrors = [];
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const selectedPlan = viewModel.plans.find((plan) => String(plan.id) === String(plan_id));

    if (!form.company_name) fieldErrors.push("Company name is required.");
    if (!form.email || !emailPattern.test(form.email)) fieldErrors.push("A valid email is required.");
    if (!form.phone) fieldErrors.push("Phone number is required.");
    if (!["India (+91)", "United States (+1)", "United Kingdom (+44)", "Australia (+61)", "Singapore (+65)"].includes(form.country)) {
      fieldErrors.push("Please select a valid country.");
    }
    if (!timezones.includes(form.timezone)) fieldErrors.push("Please select a valid timezone.");
    if (password.length < 8) fieldErrors.push("Password must be at least 8 characters long.");
    if (password !== confirm_password) fieldErrors.push("Passwords do not match.");
    if (!["yearly", "monthly"].includes(form.billing_cycle)) fieldErrors.push("Please select a valid billing cycle.");
    if (!selectedPlan) fieldErrors.push("Please choose a plan.");

    if (fieldErrors.length) {
      viewModel.fieldErrors = fieldErrors;
      return res.status(400).render("signup", viewModel);
    }

    const existingUser = await db.query("SELECT id FROM users WHERE email = $1", [form.email]);

    if (existingUser.rows[0]) {
      viewModel.fieldErrors = ["An account with this email already exists."];
      return res.status(409).render("signup", viewModel);
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await db.query(
      `
        INSERT INTO users
          (company_name, email, phone, country, timezone, password, plan_id, billing_cycle, is_active)
        VALUES
          ($1, $2, $3, $4, $5, $6, $7, $8, false)
      `,
      [
        form.company_name,
        form.email,
        form.phone,
        form.country,
        form.timezone,
        hashedPassword,
        selectedPlan.id,
        form.billing_cycle,
      ]
    );

    req.flash("success", "Account created! Awaiting admin activation.");
    return res.redirect("/login");
  } catch (error) {
    return next(error);
  }
}

function showLogin(req, res) {
  if (req.currentUser && req.currentUser.is_active) {
    return res.redirect("/dashboard");
  }

  if (req.currentUser && !req.currentUser.is_active) {
    return res.redirect("/contact");
  }

  return res.render("login", {
    title: "CrmOne Login",
    form: { email: "" },
  });
}

async function login(req, res, next) {
  const email = (req.body.email || "").trim().toLowerCase();
  const password = req.body.password || "";

  if (!email || !password) {
    return res.status(400).render("login", {
      title: "CrmOne Login",
      form: { email },
      manualError: "Email and password are required.",
    });
  }

  try {
    const result = await db.query(
      `
        SELECT
          users.id,
          users.company_name,
          users.email,
          users.password,
          users.is_active
        FROM users
        WHERE email = $1
      `,
      [email]
    );

    const user = result.rows[0];

    if (!user) {
      return res.status(401).render("login", {
        title: "CrmOne Login",
        form: { email },
        manualError: "Invalid email or password.",
      });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).render("login", {
        title: "CrmOne Login",
        form: { email },
        manualError: "Invalid email or password.",
      });
    }

    req.session.userId = user.id;

    if (user.is_active) {
      return res.redirect("/dashboard");
    }

    return res.redirect("/contact");
  } catch (error) {
    return next(error);
  }
}

function logout(req, res) {
  req.session.destroy(() => {
    res.redirect("/login");
  });
}

async function showContact(req, res, next) {
  try {
    if (req.currentUser && req.currentUser.is_active) {
      return res.redirect("/dashboard");
    }

    return res.render("contact", {
      title: "Activation Pending",
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  showSignup,
  signup,
  showLogin,
  login,
  logout,
  showContact,
};
