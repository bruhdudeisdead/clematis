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

logger.log("[server]: Connecting to DB...");
//Database
try {
  knex.raw('select 1+1 as result').then(function () {
    logger.log("[server]: Connected!");
  });
} catch(e) {
  throw `Failed to connect to database.\n${e}`;
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

logger.log("[server]: Creating all routes.")
for (const route of routes) {
  if (typeof route.route !== "function" && typeof route.route.use !== "function") {
    logger.error(`[ERROR] Route for path ${route.path} is invalid:`, route.route);
    continue;
  }
  app.use(route.path, route.route);
}

app.get("/", (req, res) => {
  res.send('clematis');
});

app.listen(config.http.port, async () => {
  logger.log(`[server]: clematis is listening on ${config.http.port}.`);
})