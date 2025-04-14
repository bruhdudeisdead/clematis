// ./api/users.js
const express = require("express");
const route = express.Router();

// [POST] Account Creation
route.get("", (req, res) => {
    res.send('creation');
})

// [POST] Login
route.get("/authenticate", (req, res) => {
    res.send('authentication endpoint');
})

// [POST] Reset Password
route.get("/forgotPassword", (req, res) => {
    res.send('forgotten password endpoint');
})

// [GET] User Details
route.get("/me", (req, res) => {
    res.send('me endpoint');
})

module.exports = route;