const knex = require("db");
const bcrypt = require("bcrypt");
const utils = require("utils");
const logger = require("logger");

const auth = {
    async hashPassword(password) {
        try {
            const saltRounds = 12;
            const hash = await bcrypt.hash(password, saltRounds);
            return hash;
        } catch (err) {
            logger.error("Error hashing string:", err);
        }
    },

    async verifyPassword(plain, hash) {
        try {
            const match = await bcrypt.compare(plain, hash);
            if (match) {
                return true;
            } else {
                return false;
            }
        } catch (err) {
            logger.error(err);
            return false;
        }
    },

    async validateToken(client, token, req, res, next) {
        try {
            const tokenRow = await knex("tokens")
                .select("user_id", "token", "vine_client", "created_at")
                .where("token", token)
                .where("vine_client", client)
                .first();

            if (!tokenRow) {
                return utils.generateError(res, 401, 103, "Authenticate first");
            }

            req.user = tokenRow;
            next();
        } catch (err) {
            logger.error(err);
            return utils.generateError(res, 500, 500, "Internal server error");
        }
    }
}

module.exports = auth;