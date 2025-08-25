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

    async validateToken(client, token) {
        if (!vine_session_id) {
            generateError(401, 103, "Authenticate first");
            return;
        }

        try {
            const tokenRow = await knex("tokens")
                .select("user_id, token, vine_client, created_at")
                .where("token", token)
                .where("vine_client", client)
                .first();

            if (!tokenRow) {
                generateError(401, 103, "Authenticate first");
                return;
            }

            if (tokenRow.vine_client && tokenRow.vine_client != client) {
                generateError(401, 103, "");
                return;
            }

            utils.generateSuccess();
            return;
        } catch (err) {
            console.error(err);
            generateError(500, 420, "Please try again later.");
            return;
        }
    }
}

module.exports = auth;