const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const fs = require("fs");
const path = require("path");

const config = require("../config.json");

if (config.storage.driver === "local" && !fs.existsSync(config.storage.local.uploadsDir)) {
    fs.mkdirSync(config.storage.local.uploadsDir, { recursive: true });
}

let s3;
if (config.storage.driver === "s3") {
    const s3Config = config.storage.s3;
    s3 = new S3Client({
        region: s3Config.region,
        endpoint: s3Config.endpoint,
        forcePathStyle: s3Config.forcePathStyle,
        credentials: {
            accessKeyId: s3Config.accessKeyId,
            secretAccessKey: s3Config.secretAccessKey,
        },
    });
}

async function saveFile(file, folder = "") {
    const timestampedName = `${Date.now()}_${file.originalname}`;
    const objectKey = folder ? `${folder}/${timestampedName}` : timestampedName;

    if (config.storage.driver === "local") {
        const filePath = path.join(config.storage.local.uploadsDir, objectKey);
        await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
        await fs.promises.writeFile(filePath, file.buffer);
        return `${config.urls.baseUrl}/uploads/${objectKey}`;
    } else if (config.storage.driver === "s3") {
        const s3Config = config.storage.s3;
        await s3.send(new PutObjectCommand({
            Bucket: s3Config.bucket,
            Key: objectKey,
            Body: file.buffer,
            ContentType: file.mimetype
        }));
        return `${s3Config.baseUrl}/${objectKey}`;
    }
}

module.exports = { saveFile };
