const express = require("express");
const ctrl = require("../controllers/taskController");
const upload = require("../middlewares/upload");

const router = express.Router();

router.get("/", ctrl.listPage);
router.get("/data", ctrl.getTaskData);
router.post("/create", ctrl.createTask);
router.get("/:id", ctrl.showTaskDetail);
router.post("/:id/update", ctrl.updateTask);
router.post("/:id/status", express.json(), ctrl.updateTaskStatus);
router.post("/:id/delete", ctrl.deleteTask);
router.post("/:id/comment", ctrl.addComment);
router.post("/:id/attachment", (req, res, next) => {
  upload.single("attachment")(req, res, (error) => {
    if (error) {
      req.flash("error", error.message || "Unable to upload attachment.");
      return res.redirect(`/task/${req.params.id}`);
    }

    return ctrl.addAttachment(req, res, next);
  });
});

module.exports = router;
