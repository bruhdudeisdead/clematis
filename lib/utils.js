const crypto = require("crypto");
const logger = require("logger");
const config = require("../config.json");
const fs = require("fs").promises;
const path = require("path");
const os = require("os");
const { spawn } = require("child_process");

const utils = {
    generateToken() {
        try {
            return crypto.randomBytes(16).toString('hex');
        } catch (err) {
            logger.error("Failed to generate token: ", err);
            throw err;
        }
    },

    generateSnowflake() {
        let sequence = 0n;
        const machineId = 1n;
        const timestamp = BigInt(Date.now());

        const snowflake = (timestamp << 22n) | (machineId << 12n) | sequence;

        sequence = (sequence + 1n) & 0xfffn;

        return snowflake.toString();
    },

    generateShareId(length = 8) {
        const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
        const charactersLength = characters.length;
        let id = "";

        for (let i = 0; i < length; i++) {
            const randomIndex = crypto.randomInt(0, charactersLength);
            id += characters[randomIndex];
        }

        return id;
    },
    
    async getVideoBuffer(videoUrl) {
        if (config.storage.driver === "s3") {
            const response = await fetch(videoUrl);
            if (!response.ok) {
                const err = new Error(`Failed to fetch video: ${response.statusText}`);
                logger.error(err);
                throw err;
            }
            return Buffer.from(await response.arrayBuffer());
        } else if (config.storage.driver === "local") {
            const localPath = videoUrl.replace(
                config.urls.baseUrl + "/uploads",
                config.storage.local.uploadsDir || "./uploads"
            );
            return await fs.readFile(localPath);
        } else {
            const err = new Error(`Unsupported storage driver: ${config.storage.driver}`);
            logger.error(err);
            throw err;
        }
    },

    async generateThumbnail(videoBuffer, filename = "thumbnail.jpg") {
        const tmpVideoPath = path.join(os.tmpdir(), `video-${Date.now()}.mp4`);

        try {
            await fs.writeFile(tmpVideoPath, videoBuffer);

            const buffer = await new Promise((resolve, reject) => {
                const ffmpeg = spawn("ffmpeg", [
                    "-i", tmpVideoPath,
                    "-ss", "00:00:00",
                    "-vframes", "1",
                    "-f", "image2",
                    "pipe:1"
                ]);

                const chunks = [];
                const errors = [];

                ffmpeg.stdout.on("data", chunk => chunks.push(chunk));
                ffmpeg.stderr.on("data", chunk => errors.push(chunk));

                ffmpeg.on("close", code => {
                    if (code === 0) {
                        resolve(Buffer.concat(chunks));
                    } else {
                        const err = new Error(`ffmpeg exited with code ${code}\n${Buffer.concat(errors).toString()}`);
                        logger.error(err);
                        reject(err);
                    }
                });
            });

            return {
                buffer,
                originalname: "thumbnail.jpg",
                mimetype: "image/jpeg"
            };
        } finally {
            try { await fs.unlink(tmpVideoPath); } catch {}
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
