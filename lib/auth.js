const knex = require("db");
const bcrypt = require("bcrypt");

const auth = {
    async verifyPassword(plain, hash) {
        try {
            const match = await bcrypt.compare(plain, hash);
            if (match) {
                return true;
            } else {
                return false;
            }
        } catch (err) {
            console.error(err);
            return false;
        }
    },

    async validateToken(client, token, req, res, next) {
        try {
            const tokenRow = await knex("tokens")
                .select("user_id, token, vine_client, created_at")
                .where("token", token)
                .where("vine_client", client);

            if (!tokenRow) {
                return utils.generateError(res, 401, 103, "Authenticate first");
            }

            req.user = tokenRow;
            next();
        } catch (err) {
            console.error(err);
            return utils.generateError(res, 500, 500, "Internal server error");
        }
    }
}

module.exports = auth;