const express = require("express");
const userController = require("../controllers/userController");
const { isAuthenticated } = require("../middlewares/auth");

const router = express.Router();

router.use(isAuthenticated);

router.get("/dashboard", userController.showDashboard);
router.get("/users", userController.showUsers);
router.post("/users/:id/activate", userController.activateUser);
router.post("/users/:id/deactivate", userController.deactivateUser);
router.post("/users/:id/delete", userController.deleteUser);

module.exports = router;
