const express = require("express");
const route = express.Router();
const storage = require("storage");
const utils = require("utils");
const logger = require("logger");
const auth = require("auth");
const { fileTypeFromBuffer } = require('file-type');
const config = require("../../config.json");

route.use((req, res, next) => {
    const vine_session_id = req.headers["vine-session-id"];
    const vine_client = req.headers["x-vine-client"] || "";

    if (!vine_session_id || !vine_client) {
        return utils.generateError(res, 401, 103, "Authenticate first");
    }

    auth.validateToken(vine_client, vine_session_id, req, res, next);
});

// [PUT] Upload Video
route.put("/videos/:filename", express.raw({ type: "video/*", limit: "8mb" }), async (req, res) => {
    try {
        const tokenRow = req.user;
      
        if (!tokenRow) {
            return utils.generateError(res, 401, 103, "Authenticate first");
        }

        const type = await fileTypeFromBuffer(req.body);
        if (!type || !type.mime.startsWith("video/")) {
            return utils.generateError(res, 400, 104, "Uploaded file is not a valid video");
        }

        const file = {
            buffer: req.body,
            originalname: tokenRow.user_id + "_" + req.params.filename,
            mimetype: type.mime
        };

        const fileUrl = await storage.saveFile(file, "videos");
        res.set("X-Upload-Key", fileUrl);
        return utils.generateSuccess(res);
    } catch (err) {
        logger.error(err);
        return utils.generateError(res, 500, 104, "Failed to save video");
    }
});

// [PUT] Upload Thumbnail
route.put("/thumbs/:filename", express.raw({ type: "image/*", limit: "2mb" }), (req, res) => {
    const tokenRow = req.user;

    if (!tokenRow) {
        return utils.generateError(res, 401, 103, "Authenticate first");
    }

    const fileUrl = config.urls.baseUrl + "/autoGenThumb";
    res.set("X-Upload-Key", fileUrl);
    return utils.generateSuccess(res);
});

// [PUT] Upload Avatar
route.put("/avatars/:filename", express.raw({ type: "image/*", limit: "2mb" }), async (req, res) => {
    try {
        const tokenRow = req.user;
      
        if (!tokenRow) {
            return utils.generateError(res, 401, 103, "Authenticate first");
        }

        const type = await fileTypeFromBuffer(req.body);
        if (!type || !type.mime.startsWith("image/")) {
            return utils.generateError(res, 400, 104, "Uploaded file is not a valid image");
        }

        const file = {
            buffer: req.body,
            originalname: tokenRow.user_id + "_" + req.params.filename,
            mimetype: type.mime
        };

        const fileUrl = await storage.saveFile(file, "avatars");
        res.set("X-Upload-Key", fileUrl);
        return utils.generateSuccess(res);
    } catch (err) {
        logger.error(err);
        return utils.generateError(res, 500, 104, "Failed to save avatar");
    }
});

module.exports = route;