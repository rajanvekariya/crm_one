const express = require("express");
const planController = require("../controllers/planController");
const companyController = require("../controllers/companyController");
const { isAuthenticated } = require("../middlewares/auth");

const router = express.Router();

router.use(isAuthenticated);

// Plan Routes
router.get("/plans", planController.listPlans);
router.post("/plans", planController.createPlan);
router.post("/plans/:id/update", planController.updatePlan);
router.post("/plans/:id/delete", planController.deletePlan);

// Company Routes
router.get("/companies", companyController.listCompanies);

module.exports = router;
