// ./api/users.js
const express = require("express");
const router = express.Router();
const empty_timeline = require('../../sampledata/timeline.json');

router.get("/", (req, res) => {
  res.send("Timelines route working!");
});

// Home Timeline
router.get("/graph", (req, res) => {
    res.json(empty_timeline);
});

// Popular Timeline
router.get("/popular", (req, res) => {
    res.json(empty_timeline);
});

// Editor's Picks Timeline
router.get("/promoted", (req, res) => {
    res.json(empty_timeline);
});

// Profile Timeline
router.get("/users/:user_id", (req, res) => {
    res.json(empty_timeline);
});

module.exports = router;