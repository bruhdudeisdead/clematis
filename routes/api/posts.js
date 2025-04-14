// ./api/users.js
const express = require("express");
const router = express.Router();

router.get("/", (req, res) => {
  res.send("Posts route working!");
});

module.exports = router;