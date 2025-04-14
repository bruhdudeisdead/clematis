// ./api/users.js
const express = require("express");
const router = express.Router();

router.get("/", (req, res) => {
  res.send("Search route working!");
});

module.exports = router;