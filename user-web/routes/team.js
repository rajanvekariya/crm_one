const express = require("express");
const router = express.Router();
const teamController = require("../controllers/teamController");
const { isAuthenticated, ensureActive } = require("../middlewares/auth");

// Public route
router.get("/invite/:id/:companyId", teamController.acceptInvite);

// Protected routes
router.use(isAuthenticated);
router.use(ensureActive);

router.get("/team", teamController.showTeam);
router.post("/team/invite", teamController.sendInvite);
router.post("/team/invite/revoke", teamController.revokeInvite);
router.post("/team/member/update", teamController.updateMember);
router.post("/team/member/remove", teamController.removeMember);

module.exports = router;
