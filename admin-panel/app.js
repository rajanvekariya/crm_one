require("dotenv").config();

const path = require("path");
const express = require("express");
const session = require("express-session");
const methodOverride = require("method-override");

const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/users");
const adminModules = require("./routes/adminModules");

const app = express();
const port = Number(process.env.PORT) || 3001;

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));
app.use(methodOverride("_method"));
app.use(
  session({
    name: "crmone-admin.sid",
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      path: "/api",
      maxAge: 1000 * 60 * 60 * 8,
    },
  })
);
app.use((req, res, next) => {
  if (!req.session) return next();
  const flashStore = req.session.flash || { success: [], error: [] };

  req.flash = (type, message) => {
    if (message) {
      flashStore[type] = flashStore[type] || [];
      flashStore[type].push(message);
      req.session.flash = flashStore;
      return;
    }

    const messages = flashStore[type] || [];
    flashStore[type] = [];
    req.session.flash = flashStore;
    return messages;
  };

  next();
});

app.use((req, res, next) => {
  res.locals.currentAdmin = (req.session && req.session.admin) || null;
  res.locals.successMessages = req.flash ? req.flash("success") : [];
  res.locals.errorMessages = req.flash ? req.flash("error") : [];
  next();
});

app.use("/api", authRoutes);
app.use("/api", userRoutes);
app.use("/api", adminModules);

const { initDatabase } = require("./db");

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).send("Something went wrong.");
});

async function startServer() {
  console.log("Admin Panel Server starting...");
  await initDatabase();
  app.listen(port, () => {
    console.log(`Admin panel running on http://localhost:${port}`);
  });
}

startServer();
