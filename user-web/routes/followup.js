const path = require("path");
const multer = require("multer");
const router = require("express").Router();
const ctrl = require("../controllers/followupController");

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "public/uploads");
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({ storage: storage });

router.get("/", ctrl.listPage);
router.post("/create", ctrl.createFollowup);
router.post("/upload", upload.array("files", 12), (req, res) => {
  const fileUrls = req.files.map((file) => `/uploads/${file.filename}`);
  res.json({ urls: fileUrls });
});
router.get("/notifications/unread", ctrl.getUnreadCount);
router.post("/notifications/mark-read", ctrl.markAllRead);
router.get("/:id", ctrl.getFollowupById);
router.post("/:id/update", ctrl.updateFollowup);
router.post("/:id/delete", ctrl.deleteFollowup);

module.exports = router;
