require("./aliases")();
const express = require("express");
const config = require("./config.json");
const logger = require("logger")
const knex = require("db");
const app = express()

const path = require("path");

const routes = require("./routes/index.js");

if(config.env.logLevel > 0){
  app.use((req, res, next) => {
    logger.http_log(req);
    next();
  });
}

logger.log("[server]: Creating all routes.")
for (const route of routes) {
  if (typeof route.route !== "function" && typeof route.route.use !== "function") {
    console.error(`[ERROR] Route for path ${route.path} is invalid:`, route.route);
    continue;
  }
  console.log(`[DEBUG] Mounting route at ${route.path}`);
  app.use(route.path, route.route);
}

app.get("/", (req, res) => {
  res.send('You aren\'t supposed to be here.');
});

app.listen(config.http.port, async () => {
  logger.log(`[server]: clematis API is listening on ${config.http.port}.`);
})