const bcrypt = require("bcrypt");
const db = require("../db");

let countryData = { countries: { all: [] }, currencies: {} };

try {
  countryData = require("country-data");
} catch (error) {
  countryData = { countries: { all: [] }, currencies: {} };
}

const DEFAULT_COUNTRY_NAME = "India";
const DEFAULT_TIMEZONE = "Asia/Kolkata";
const FALLBACK_TIMEZONES = [
  "Asia/Kolkata",
  "Asia/Dubai",
  "Europe/London",
  "America/New_York",
  "Australia/Sydney",
  "UTC",
];

const SUGGESTED_TIMEZONES_BY_COUNTRY = {
  AE: "Asia/Dubai",
  AU: "Australia/Sydney",
  CA: "America/Toronto",
  DE: "Europe/Berlin",
  ES: "Europe/Madrid",
  FR: "Europe/Paris",
  GB: "Europe/London",
  HK: "Asia/Hong_Kong",
  ID: "Asia/Jakarta",
  IE: "Europe/Dublin",
  IN: "Asia/Kolkata",
  IT: "Europe/Rome",
  JP: "Asia/Tokyo",
  MX: "America/Mexico_City",
  MY: "Asia/Kuala_Lumpur",
  NG: "Africa/Lagos",
  NL: "Europe/Amsterdam",
  NZ: "Pacific/Auckland",
  PH: "Asia/Manila",
  PK: "Asia/Karachi",
  PT: "Europe/Lisbon",
  SA: "Asia/Riyadh",
  SE: "Europe/Stockholm",
  SG: "Asia/Singapore",
  TH: "Asia/Bangkok",
  TR: "Europe/Istanbul",
  US: "America/New_York",
  VN: "Asia/Ho_Chi_Minh",
  ZA: "Africa/Johannesburg",
};

const PRICING_EXCHANGE_RATES = {
  AED: 0.044,
  AUD: 0.018,
  CAD: 0.016,
  CHF: 0.01,
  CNY: 0.087,
  DKK: 0.083,
  EUR: 0.011,
  GBP: 0.0095,
  HKD: 0.094,
  IDR: 198.0,
  INR: 1,
  JPY: 1.78,
  KRW: 16.5,
  MYR: 0.056,
  NOK: 0.13,
  NZD: 0.02,
  PHP: 0.68,
  PLN: 0.047,
  SAR: 0.045,
  SEK: 0.13,
  SGD: 0.016,
  THB: 0.43,
  TRY: 0.46,
  TWD: 0.39,
  USD: 0.012,
  VND: 306,
  ZAR: 0.22,
};

const TIMEZONES =
  typeof Intl.supportedValuesOf === "function"
    ? Intl.supportedValuesOf("timeZone").sort((left, right) => left.localeCompare(right))
    : FALLBACK_TIMEZONES;

function sanitizeDialCode(dialCode) {
  return (dialCode || "").replace(/\s+/g, " ").trim();
}

function buildCountryOptions() {
  const allCountries = Array.isArray(countryData.countries.all) ? countryData.countries.all : [];

  const assignedCountries = allCountries
    .filter((country) => country.status === "assigned" && country.alpha2 && country.name)
    .map((country) => {
      const dialCode = sanitizeDialCode(country.countryCallingCodes.find(Boolean) || "");
      const currencyCode = country.currencies[0] || "USD";
      const currencyMeta = countryData.currencies[currencyCode] || { symbol: currencyCode };

      return {
        code: country.alpha2,
        name: country.name,
        dialCode: dialCode || "+1",
        currencyCode,
        currencySymbol: currencyMeta.symbol || currencyCode,
        suggestedTimezone: SUGGESTED_TIMEZONES_BY_COUNTRY[country.alpha2] || DEFAULT_TIMEZONE,
      };
    })
    .filter((country) => country.dialCode)
    .sort((left, right) => left.name.localeCompare(right.name));

  if (assignedCountries.length) {
    return assignedCountries;
  }

  return [
    {
      code: "IN",
      name: "India",
      dialCode: "+91",
      currencyCode: "INR",
      currencySymbol: "₹",
      suggestedTimezone: DEFAULT_TIMEZONE,
    },
    {
      code: "US",
      name: "United States",
      dialCode: "+1",
      currencyCode: "USD",
      currencySymbol: "$",
      suggestedTimezone: "America/New_York",
    },
    {
      code: "GB",
      name: "United Kingdom",
      dialCode: "+44",
      currencyCode: "GBP",
      currencySymbol: "£",
      suggestedTimezone: "Europe/London",
    },
    {
      code: "AU",
      name: "Australia",
      dialCode: "+61",
      currencyCode: "AUD",
      currencySymbol: "$",
      suggestedTimezone: "Australia/Sydney",
    },
    {
      code: "SG",
      name: "Singapore",
      dialCode: "+65",
      currencyCode: "SGD",
      currencySymbol: "$",
      suggestedTimezone: "Asia/Singapore",
    },
  ];
}

const COUNTRY_OPTIONS = buildCountryOptions();
const VALID_COUNTRY_NAMES = new Set(COUNTRY_OPTIONS.map((country) => country.name));
const COUNTRY_BY_NAME = new Map(COUNTRY_OPTIONS.map((country) => [country.name, country]));
const DEFAULT_COUNTRY = COUNTRY_BY_NAME.get(DEFAULT_COUNTRY_NAME) || COUNTRY_OPTIONS[0];

function normalizeCountryValue(value = "") {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return DEFAULT_COUNTRY.name;
  }

  if (VALID_COUNTRY_NAMES.has(trimmedValue)) {
    return trimmedValue;
  }

  const withoutDialCode = trimmedValue.replace(/\s*\(\+[\d ]+\)\s*$/, "").trim();

  if (VALID_COUNTRY_NAMES.has(withoutDialCode)) {
    return withoutDialCode;
  }

  return trimmedValue;
}

function normalizeTimezoneValue(value = "", fallbackTimezone = DEFAULT_TIMEZONE) {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return fallbackTimezone;
  }

  if (trimmedValue === "Asia/Calcutta") {
    return "Asia/Kolkata";
  }

  return trimmedValue;
}

function formatPlanPrice(amount, currencyCode) {
  try {
    return new Intl.NumberFormat("en", {
      style: "currency",
      currency: currencyCode,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch (error) {
    return `${currencyCode} ${amount}`;
  }
}

function getPlanDisplayPrice(plan, countryName, billingCycle) {
  const country = COUNTRY_BY_NAME.get(countryName) || DEFAULT_COUNTRY;
  const targetCurrency = PRICING_EXCHANGE_RATES[country.currencyCode] ? country.currencyCode : "USD";
  const rate = PRICING_EXCHANGE_RATES[targetCurrency] || PRICING_EXCHANGE_RATES.USD;
  const baseAmount =
    billingCycle === "monthly" ? Number(plan.price_monthly || 0) : Number(plan.price_yearly || 0);
  const localizedAmount = Math.max(1, Math.round(baseAmount * rate));

  return {
    amount: localizedAmount,
    currencyCode: targetCurrency,
    formatted: formatPlanPrice(localizedAmount, targetCurrency),
  };
}

async function fetchPlans() {
  const result = await db.query(
    "SELECT id, name, price_yearly, price_monthly, max_users FROM plans ORDER BY id ASC"
  );
  return result.rows;
}

function enrichPlansForView(plans, countryName, billingCycle) {
  return plans.map((plan) => {
    const displayPrice = getPlanDisplayPrice(plan, countryName, billingCycle);

    return {
      ...plan,
      displayPrice,
    };
  });
}

function buildSignupModel(overrides = {}) {
  const normalizedCountry = normalizeCountryValue(overrides.country);
  const selectedCountry = COUNTRY_BY_NAME.get(normalizedCountry) || DEFAULT_COUNTRY;
  const submittedTimezone = normalizeTimezoneValue(overrides.timezone, selectedCountry.suggestedTimezone || DEFAULT_TIMEZONE);
  const normalizedTimezone =
    submittedTimezone && TIMEZONES.includes(submittedTimezone)
      ? submittedTimezone
      : selectedCountry.suggestedTimezone || DEFAULT_TIMEZONE;

  return {
    title: "Set Up Your CrmOne Account",
    countries: COUNTRY_OPTIONS,
    timezones: TIMEZONES,
    pricingExchangeRates: PRICING_EXCHANGE_RATES,
    plans: [],
    form: {
      company_name: "",
      email: "",
      phone: "",
      country: selectedCountry.name,
      timezone: normalizedTimezone,
      billing_cycle: "yearly",
      plan_id: "",
      ...overrides,
      country: normalizedCountry,
      timezone: normalizedTimezone,
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
      return res.redirect("/activation-pending");
    }

    const viewModel = buildSignupModel();
    const plans = await fetchPlans();

    viewModel.form.plan_id = plans[0] ? String(plans[0].id) : "";
    viewModel.plans = enrichPlansForView(plans, viewModel.form.country, viewModel.form.billing_cycle);

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
    country = DEFAULT_COUNTRY.name,
    timezone = DEFAULT_TIMEZONE,
    password = "",
    confirm_password = "",
    billing_cycle = "yearly",
    plan_id = "",
  } = req.body;

  const form = {
    company_name: company_name.trim(),
    email: email.trim().toLowerCase(),
    phone: phone.trim(),
    country: normalizeCountryValue(country),
    timezone: normalizeTimezoneValue(timezone, DEFAULT_TIMEZONE),
    billing_cycle,
    plan_id: String(plan_id),
  };

  try {
    const viewModel = buildSignupModel(form);
    const rawPlans = await fetchPlans();
    viewModel.plans = enrichPlansForView(rawPlans, viewModel.form.country, viewModel.form.billing_cycle);

    const fieldErrors = [];
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const selectedPlan = rawPlans.find((plan) => String(plan.id) === String(plan_id));

    if (!form.company_name) fieldErrors.push("Company name is required.");
    if (!form.email || !emailPattern.test(form.email)) fieldErrors.push("A valid email is required.");
    if (!form.phone) fieldErrors.push("Phone number is required.");
    if (!VALID_COUNTRY_NAMES.has(form.country)) fieldErrors.push("Please select a valid country.");
    if (!TIMEZONES.includes(form.timezone)) fieldErrors.push("Please select a valid timezone.");
    if (password.length < 8) fieldErrors.push("Password must be at least 8 characters long.");
    if (password !== confirm_password) fieldErrors.push("Passwords do not match.");
    if (!["yearly", "monthly"].includes(form.billing_cycle)) {
      fieldErrors.push("Please select a valid billing cycle.");
    }
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
    return res.redirect("/activation-pending");
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

    return res.redirect("/activation-pending");
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
