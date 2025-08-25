const knex = require("db");
const crypto = require("crypto")
const logger = require("logger")

const utils = {
    generateToken() {
        try {
            const buffer = crypto.randomBytes(16);
            const token = buffer.toString('hex')
            return token
        } catch(err) {
            logger.err("Failed to generate token: ", err)
        }
    },

    generateError(status, code, error) {
        return res.status(status).json({
            code: code,
            data: {},
            success: false,
            error: error
        });
    },

    generateSuccess() {
        return res.status(401).json({
            code: "",
            data: {},
            success: true,
            error: ""
        });
    }
}

module.exports = utils;