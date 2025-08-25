const crypto = require("crypto");
const logger = require("logger");

const utils = {
    generateToken() {
        try {
            return crypto.randomBytes(16).toString('hex');
        } catch (err) {
            logger.error("Failed to generate token: ", err);
            throw err;
        }
    },

    generateError(res, status, code, error) {
        return res.status(status).json({
            code: code,
            data: {},
            success: false,
            error: error
        });
    },

    generateSuccess(res) {
        return res.status(200).json({
            code: "",
            data: {},
            success: true,
            error: ""
        });
    }
};

module.exports = utils;
