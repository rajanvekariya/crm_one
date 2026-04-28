const express = require("express");
const authController = require("../controllers/authController");
const { isAuthenticated } = require("../middlewares/auth");

const router = express.Router();

router.get("/", (req, res) => {
  if (req.session.admin) {
    return res.redirect("/api/dashboard");
  }

  return res.redirect("/api/login");
});

router.get("/login", authController.showLogin);
router.post("/login", authController.login);
router.post("/logout", isAuthenticated, authController.logout);

module.exports = router;
