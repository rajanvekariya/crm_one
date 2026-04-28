const express = require("express");
const dashboardController = require("../controllers/dashboardController");
const { isAuthenticated, ensureActive } = require("../middlewares/auth");

const router = express.Router();

router.get("/dashboard", isAuthenticated, ensureActive, dashboardController.showDashboard);

module.exports = router;
