const express = require("express");
const route = express.Router();
const knex = require("db");
const utils = require("utils");
const auth = require("auth");

route.use((req, res, next) => {
    const vine_session_id = req.headers["vine-session-id"];
    const vine_client = req.headers["x-vine-client"] || "";

    if (!vine_session_id || !vine_client) {
        return utils.generateError(res, 401, 103, "Authenticate first");
    }

    auth.validateToken(vine_client, vine_session_id, req, res, next);
});


route.get("/", (req, res) => {
  res.send("/tags");
});

// [GET] Search
route.get("/search/:query", async (req, res) => {
    const query = req.params.query;
    const sanitizedQuery = query.replace(/[%_]/g, "\\$&");
    const page = req.query.page ? Number(req.query.page) : 1;
    const perPage = 15;
    const offset = (page - 1) * perPage;

    const response = {
        code: "",
        data: {
            count: 0,
            records: [],
            previousPage: !req.query.page ? 1 : Number(req.query.page) - 1,
            backAnchor: -1,
            anchor: 0,
            nextPage: !req.query.page ? 2 : Number(req.query.page) + 1,
        },
        size: 0,
        success: true,
        error: ""
    };

    try {
        const tokenRow = req.user;

        if (!tokenRow) {
            return utils.generateError(res, 401, 103, "Authenticate first");
        }

        const rows = await knex("tags")
        .select(
            "id",
            "tag"
        )
        .where("tag", "like", `%${sanitizedQuery}%`)
        .orderBy("id", "desc")
        .limit(perPage)
        .offset(offset);

        response.data.count = rows.length;
        response.size = rows.length;

        for (const row of rows) {
            const tag = {
                tagId: row.id,
                tag: row.tag,
            };

            response.data.records.push(tag);
        }
    } catch (err) {
        response.success = false;
        response.error = err.message;
    }
    res.send(response);
});

module.exports = route;