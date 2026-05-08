const fs = require("fs");
const path = require("path");
const multer = require("multer");

const uploadDir = path.join(__dirname, "..", "public", "uploads", "tasks");
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const safeName = String(file.originalname || "attachment").replace(/\s+/g, "-");
    cb(null, `${Date.now()}-${safeName}`);
  },
});

module.exports = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|pdf|doc|docx|xlsx/;
    const extension = path.extname(file.originalname).toLowerCase();
    cb(null, allowed.test(extension));
  },
  limits: { fileSize: 5 * 1024 * 1024 },
});
