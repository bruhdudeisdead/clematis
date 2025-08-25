const express = require("express");
const router = express.Router();

router.get("/", (req, res) => {
  res.send("/upload");
});

module.exports = router;