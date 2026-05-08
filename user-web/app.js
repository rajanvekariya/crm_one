require("dotenv").config();

const path = require("path");
const express = require("express");
const session = require("express-session");
const methodOverride = require("method-override");

const authRoutes = require("./routes/auth");
const dashboardRoutes = require("./routes/dashboard");
const teamRoutes = require("./routes/team");
const followupRouter = require("./routes/followup");
const taskRouter = require("./routes/task");
const {
  attachCurrentUser,
  isAuthenticated: requireAuth,
  ensureActive: requireActive,
} = require("./middlewares/auth");

const app = express();
const port = Number(process.env.PORT) || 3000;

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));
app.use(methodOverride("_method"));
app.use(
  session({
    name: "crmone-user.sid",
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      path: "/",
      maxAge: 1000 * 60 * 60 * 8,
    },
  })
);
app.use((req, res, next) => {
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
app.use(attachCurrentUser);

app.use((req, res, next) => {
  res.locals.successMessages = req.flash("success");
  res.locals.errorMessages = req.flash("error");
  next();
});

app.use(authRoutes);
app.use(dashboardRoutes);
app.use(teamRoutes);
require("./utils/notificationScheduler");
app.use("/followup", requireAuth, requireActive, followupRouter);
app.use("/task", requireAuth, requireActive, taskRouter);

const { initDatabase } = require("./db");

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).send("Something went wrong.");
});

async function startServer() {
  console.log("Server starting...");
  await initDatabase();
  app.listen(port, () => {
    console.log(`User web running on http://localhost:${port}`);
  });
}

startServer();
