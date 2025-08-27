const express = require("express");
const config = require("../../config.json");
const knex = require("db");
const auth = require("auth");
const route = express.Router();
const { DateTime } = require('luxon');

route.use((req, res, next) => {
    const vine_session_id = req.headers["vine-session-id"];
    const vine_client = req.headers["x-vine-client"] || "";

    if (!vine_session_id || !vine_client) {
        return utils.generateError(res, 401, 103, "Authenticate first");
    }

    auth.validateToken(vine_client, vine_session_id, req, res, next);
});

route.get("/", (req, res) => {
  res.send("/timelines");
});

// Home Timeline
route.get("/graph", async (req, res) => {
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

        const follows = [];

        const followRows = await knex("follows")
        .select("*")
        .where("follow_from", tokenRow.user_id);

        for (const row of followRows) {
            follows.push(row.follow_to);
        }

        const rows = await knex("videos")
        .select(
            "id",
            "video_url",
            "thumbnail_url",
            "description",
            "entities",
            "user_id",
            "loops",
            "created_at",
            "promoted",
            "venue_id",
            "venue_name",
            knex.raw("(SELECT COUNT(*) FROM likes WHERE video_id = videos.id AND user_id = ?) AS liked", [tokenRow.user_id]),
            knex.raw("(SELECT COUNT(*) FROM likes WHERE video_id = videos.id) AS like_count"),
            knex.raw("(SELECT COUNT(*) FROM comments WHERE video_id = videos.id) AS comment_count"),
            knex.raw("(SELECT COUNT(*) FROM reposts WHERE video_id = videos.id) AS repost_count"),
            knex.raw("(SELECT id FROM reposts WHERE video_id = videos.id AND user_id = ?) AS repost_id", [tokenRow.user_id])
        )
        .where("is_rm", 0)
        .whereIn("user_id", follows)
        .whereNotExists(function () {
            this.select(1)
            .from("blocks")
            .whereRaw("blocks.source_user = ?", [tokenRow.user_id])
            .whereRaw("blocks.target_user = videos.user_id");
        })
        .whereNotExists(function () {
            this.select(1)
            .from("blocks")
            .whereRaw("blocks.target_user = ?", [tokenRow.user_id])
            .whereRaw("blocks.source_user = videos.user_id");
        })
        .whereNotExists(function () {
            this.select(1)
            .from("bans")
            .whereRaw("bans.user_id = videos.user_id");
        })
        .orderBy("created_at", "desc")
        .limit(perPage)
        .offset(offset);

        response.data.count = rows.length;
        response.size = rows.length;

        for (const row of rows) {
            const viewerId = tokenRow.user_id;
            const authorId = row.user_id;

            const urow = await knex("users")
            .select(
                "id",
                "username",
                "avatar_url",
                "verified",
                "bio",
                "is_explicit",
                "location",
                "background_color",
                knex.raw(
                "(SELECT COUNT(*) FROM follows WHERE follow_from = ? AND follow_to = users.id) AS following",
                [viewerId]
                )
            )
            .where("id", authorId)
            .first();

            const createdAt = DateTime.fromJSDate(row.created_at, { zone: 'utc' });
            const formattedCreatedAt = createdAt.toFormat("yyyy-MM-dd'T'HH:mm:ss.SSS");

            const post = {
                liked: row.liked,
                foursquareVenueId: row.venue_id,
                userId: row.user_id,
                private: 0,
                likes: {
                    count: row.like_count,
                    records: []
                },
                loops: {
                    count: Number(row.loops),
                    created: formattedCreatedAt,
                    velocity: 0.1,
                    onFire: 0
                },
                thumbnailUrl: row.thumbnail_url,
                explicitContent: urow.is_explicit,
                myRepostId: row.repost_id,
                vanityUrls: [],
                verified: urow.verified,
                avatarUrl: urow.avatar_url,
                videoUrls: [
                    { format: "h264", rate: 30, videoUrl: row.video_url },
                    { format: "webm", rate: 30, videoUrl: row.video_url }
                ],
                comments: {
                    count: row.comment_count,
                    records: []
                },
                entities: JSON.parse(row.entities),
                videoLowURL: row.video_url,
                videoPreview: row.video_url,
                permalinkUrl: config.urls.postShareUrl + row.id,
                username: urow.username,
                description: row.description,
                postId: row.id,
                videoUrl: row.video_url,
                created: formattedCreatedAt,
                shareUrl: config.urls.postShareUrl + row.id,
                following: Number(urow.following),
                user: {
                    userId: Number(row.user_id),
                    avatarUrl: urow.avatar_url,
                    description: urow.bio,
                    location: urow.location,
                    username: urow.username,
                    verified: Number(urow.verified),
                    profileBackground: urow.background_color,
                    following: Number(urow.following),
                    explicitContent: null
                },
                tags: [],
                promoted: row.promoted,
                reposts: {
                    count: row.repost_count,
                    records: []
                }
            };

            response.data.records.push(post);
        }
    } catch (err) {
        response.success = false;
        response.error = err.message;
    }
    res.send(response);
});

// Popular Timeline
route.get("/popular", async (req, res) => {
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

        const rows = await knex("videos")
        .select(
            "id",
            "video_url",
            "thumbnail_url",
            "description",
            "entities",
            "user_id",
            "loops",
            "created_at",
            "promoted",
            "is_explicit",
            "venue_id",
            "venue_name",
            knex.raw("(SELECT COUNT(*) FROM likes WHERE video_id = videos.id AND user_id = ?) AS liked", [tokenRow.user_id]),
            knex.raw("(SELECT COUNT(*) FROM likes WHERE video_id = videos.id) AS like_count"),
            knex.raw("(SELECT COUNT(*) FROM comments WHERE video_id = videos.id) AS comment_count"),
            knex.raw("(SELECT COUNT(*) FROM reposts WHERE video_id = videos.id) AS repost_count"),
            knex.raw("(SELECT id FROM reposts WHERE video_id = videos.id AND user_id = ?) AS repost_id", [tokenRow.user_id])
        )
        .where("is_rm", 0)
        .whereNotExists(function () {
            this.select(1)
            .from("blocks")
            .whereRaw("blocks.source_user = ?", [tokenRow.user_id])
            .whereRaw("blocks.target_user = videos.user_id");
        })
        .whereNotExists(function () {
            this.select(1)
            .from("blocks")
            .whereRaw("blocks.target_user = ?", [tokenRow.user_id])
            .whereRaw("blocks.source_user = videos.user_id");
        })
        .whereNotExists(function () {
            this.select(1)
            .from("bans")
            .whereRaw("bans.user_id = videos.user_id");
        })
        .orderBy("like_count", "desc")
        .limit(perPage)
        .offset(offset);

        response.data.count = rows.length;
        response.size = rows.length;

        for (const row of rows) {
            const viewerId = tokenRow.user_id;
            const authorId = row.user_id;

            const urow = await knex("users")
            .select(
                "id",
                "username",
                "username",
                "avatar_url",
                "verified",
                "bio",
                "is_explicit",
                "location",
                "background_color",
                knex.raw(
                "(SELECT COUNT(*) FROM follows WHERE follow_from = ? AND follow_to = users.id) AS following",
                [viewerId]
                )
            )
            .where("id", authorId)
            .first();

            const createdAt = new Date(row.created_at); 
            const formattedCreatedAt = createdAt.toISOString(); 

            const post = {
                liked: row.liked,
                foursquareVenueId: row.venue_id,
                userId: row.user_id,
                private: 0,
                likes: {
                    count: row.like_count,
                    records: []
                },
                loops: {
                    count: Number(row.loops),
                    created: formattedCreatedAt,
                    velocity: 0.1,
                    onFire: 0
                },
                thumbnailUrl: row.thumbnail_url,
                explicitContent: urow.is_explicit,
                myRepostId: row.repost_id,
                vanityUrls: [],
                verified: urow.verified,
                avatarUrl: urow.avatar_url,
                videoUrls: [
                    { format: "h264", rate: 30, videoUrl: row.video_url },
                    { format: "webm", rate: 30, videoUrl: row.video_url }
                ],
                comments: {
                    count: row.comment_count,
                    records: []
                },
                entities: JSON.parse(row.entities),
                videoLowURL: row.video_url,
                videoPreview: row.video_url,
                permalinkUrl: config.urls.postShareUrl + row.id,
                username: urow.username,
                description: row.description,
                postId: row.id,
                videoUrl: row.video_url,
                created: formattedCreatedAt,
                shareUrl: config.urls.postShareUrl + row.id,
                following: Number(urow.following),
                user: {
                    userId: Number(row.user_id),
                    avatarUrl: urow.avatar_url,
                    description: urow.bio,
                    location: urow.location,
                    username: urow.username,
                    verified: Number(urow.verified),
                    profileBackground: urow.background_color,
                    following: Number(urow.following),
                    explicitContent: null
                },
                tags: [],
                promoted: row.promoted,
                reposts: {
                    count: row.repost_count,
                    records: []
                }
            };

            response.data.records.push(post);
        }
    } catch (err) {
        response.success = false;
        response.error = err.message;
    }
    res.send(response);
});

// Editor's Picks Timeline
route.get("/promoted", async (req, res) => {
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

        const rows = await knex("videos")
        .select(
            "id",
            "video_url",
            "thumbnail_url",
            "description",
            "entities",
            "user_id",
            "loops",
            "created_at",
            "promoted",
            "is_explicit",
            "venue_id",
            "venue_name",
            knex.raw("(SELECT COUNT(*) FROM likes WHERE video_id = videos.id AND user_id = ?) AS liked", [tokenRow.user_id]),
            knex.raw("(SELECT COUNT(*) FROM likes WHERE video_id = videos.id) AS like_count"),
            knex.raw("(SELECT COUNT(*) FROM comments WHERE video_id = videos.id) AS comment_count"),
            knex.raw("(SELECT COUNT(*) FROM reposts WHERE video_id = videos.id) AS repost_count"),
            knex.raw("(SELECT id FROM reposts WHERE video_id = videos.id AND user_id = ?) AS repost_id", [tokenRow.user_id])
        )
        .where("is_rm", 0)
        .where("promoted", 1)
        .whereNotExists(function () {
            this.select(1)
            .from("blocks")
            .whereRaw("blocks.source_user = ?", [tokenRow.user_id])
            .whereRaw("blocks.target_user = videos.user_id");
        })
        .whereNotExists(function () {
            this.select(1)
            .from("blocks")
            .whereRaw("blocks.target_user = ?", [tokenRow.user_id])
            .whereRaw("blocks.source_user = videos.user_id");
        })
        .whereNotExists(function () {
            this.select(1)
            .from("bans")
            .whereRaw("bans.user_id = videos.user_id");
        })
        .orderBy("created_at", "desc")
        .limit(perPage)
        .offset(offset);

        response.data.count = rows.length;
        response.size = rows.length;

        for (const row of rows) {
            const viewerId = tokenRow.user_id;
            const authorId = row.user_id;

            const urow = await knex("users")
            .select(
                "id",
                "username",
                "username",
                "avatar_url",
                "verified",
                "bio",
                "is_explicit",
                "location",
                "background_color",
                knex.raw(
                "(SELECT COUNT(*) FROM follows WHERE follow_from = ? AND follow_to = users.id) AS following",
                [viewerId]
                )
            )
            .where("id", authorId)
            .first();

            const createdAt = new Date(row.created_at); 
            const formattedCreatedAt = createdAt.toISOString(); 

            const post = {
                liked: row.liked,
                foursquareVenueId: row.venue_id,
                userId: row.user_id,
                private: 0,
                likes: {
                    count: row.like_count,
                    records: []
                },
                loops: {
                    count: Number(row.loops),
                    created: formattedCreatedAt,
                    velocity: 0.1,
                    onFire: 0
                },
                thumbnailUrl: row.thumbnail_url,
                explicitContent: urow.is_explicit,
                myRepostId: row.repost_id,
                vanityUrls: [],
                verified: urow.verified,
                avatarUrl: urow.avatar_url,
                videoUrls: [
                    { format: "h264", rate: 30, videoUrl: row.video_url },
                    { format: "webm", rate: 30, videoUrl: row.video_url }
                ],
                comments: {
                    count: row.comment_count,
                    records: []
                },
                entities: JSON.parse(row.entities),
                videoLowURL: row.video_url,
                videoPreview: row.video_url,
                permalinkUrl: config.urls.postShareUrl + row.id,
                username: urow.username,
                description: row.description,
                postId: row.id,
                videoUrl: row.video_url,
                created: formattedCreatedAt,
                shareUrl: config.urls.postShareUrl + row.id,
                following: Number(urow.following),
                user: {
                    userId: Number(row.user_id),
                    avatarUrl: urow.avatar_url,
                    description: urow.bio,
                    location: urow.location,
                    username: urow.username,
                    verified: Number(urow.verified),
                    profileBackground: urow.background_color,
                    following: Number(urow.following),
                    explicitContent: null
                },
                tags: [],
                promoted: row.promoted,
                reposts: {
                    count: row.repost_count,
                    records: []
                }
            };

            response.data.records.push(post);
        }
    } catch (err) {
        response.success = false;
        response.error = err.message;
    }
    res.send(response);
});

// Profile Timeline
route.get("/users/:user_id", async (req, res) => {
    const userId = req.params.user_id;
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

        const rows = await knex("videos")
        .select(
            "id",
            "video_url",
            "thumbnail_url",
            "description",
            "entities",
            "user_id",
            "loops",
            "created_at",
            "promoted",
            "is_explicit",
            "venue_id",
            "venue_name",
            knex.raw("(SELECT COUNT(*) FROM likes WHERE video_id = videos.id AND user_id = ?) AS liked", [tokenRow.user_id]),
            knex.raw("(SELECT COUNT(*) FROM likes WHERE video_id = videos.id) AS like_count"),
            knex.raw("(SELECT COUNT(*) FROM comments WHERE video_id = videos.id) AS comment_count"),
            knex.raw("(SELECT COUNT(*) FROM reposts WHERE video_id = videos.id) AS repost_count"),
            knex.raw("(SELECT id FROM reposts WHERE video_id = videos.id AND user_id = ?) AS repost_id", [tokenRow.user_id])
        )
        .where("is_rm", 0)
        .where("user_id", userId)
        .whereNotExists(function () {
            this.select(1)
            .from("blocks")
            .whereRaw("blocks.source_user = ?", [tokenRow.user_id])
            .whereRaw("blocks.target_user = videos.user_id");
        })
        .whereNotExists(function () {
            this.select(1)
            .from("blocks")
            .whereRaw("blocks.target_user = ?", [tokenRow.user_id])
            .whereRaw("blocks.source_user = videos.user_id");
        })
        .whereNotExists(function () {
            this.select(1)
            .from("bans")
            .whereRaw("bans.user_id = videos.user_id");
        })
        .orderBy("created_at", "desc")
        .limit(perPage)
        .offset(offset);

        response.data.count = rows.length;
        response.size = rows.length;

        for (const row of rows) {
            const viewerId = tokenRow.user_id;
            const authorId = row.user_id;

            const urow = await knex("users")
            .select(
                "id",
                "username",
                "username",
                "avatar_url",
                "verified",
                "bio",
                "is_explicit",
                "location",
                "background_color",
                knex.raw(
                "(SELECT COUNT(*) FROM follows WHERE follow_from = ? AND follow_to = users.id) AS following",
                [viewerId]
                )
            )
            .where("id", authorId)
            .first();

            const createdAt = new Date(row.created_at); 
            const formattedCreatedAt = createdAt.toISOString(); 

            const post = {
                liked: row.liked,
                foursquareVenueId: row.venue_id,
                userId: row.user_id,
                private: 0,
                likes: {
                    count: row.like_count,
                    records: []
                },
                loops: {
                    count: Number(row.loops),
                    created: formattedCreatedAt,
                    velocity: 0.1,
                    onFire: 0
                },
                thumbnailUrl: row.thumbnail_url,
                explicitContent: urow.is_explicit,
                myRepostId: row.repost_id,
                vanityUrls: [],
                verified: urow.verified,
                avatarUrl: urow.avatar_url,
                videoUrls: [
                    { format: "h264", rate: 30, videoUrl: row.video_url },
                    { format: "webm", rate: 30, videoUrl: row.video_url }
                ],
                comments: {
                    count: row.comment_count,
                    records: []
                },
                entities: JSON.parse(row.entities),
                videoLowURL: row.video_url,
                videoPreview: row.video_url,
                permalinkUrl: config.urls.postShareUrl + row.id,
                username: urow.username,
                description: row.description,
                postId: row.id,
                videoUrl: row.video_url,
                created: formattedCreatedAt,
                shareUrl: config.urls.postShareUrl + row.id,
                following: Number(urow.following),
                user: {
                    userId: Number(row.user_id),
                    avatarUrl: urow.avatar_url,
                    description: urow.bio,
                    location: urow.location,
                    username: urow.username,
                    verified: Number(urow.verified),
                    profileBackground: urow.background_color,
                    following: Number(urow.following),
                    explicitContent: null
                },
                tags: [],
                promoted: row.promoted,
                reposts: {
                    count: row.repost_count,
                    records: []
                }
            };

            response.data.records.push(post);
        }
    } catch (err) {
        response.success = false;
        response.error = err.message;
    }
    res.send(response);
});

module.exports = route;