// ./api/users.js
const express = require("express");
const router = express.Router();

router.get("/", (req, res) => {
  res.send("Tags route working!");
});

module.exports = router;