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
        try {
            const tokenRow = await knex("tokens")
                .select("user_id, token, vine_client, created_at")
                .where("token", token)
                .where("vine_client", client)
                .first();

            if (!tokenRow) {
                return false;
            }

            return true;
        } catch (err) {
            console.error(err);
            return false; 
        }
    }
}

module.exports = auth;