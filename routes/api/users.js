const express = require("express");
const route = express.Router();
const knex = require("db");
const htmlspecialchars = require("htmlspecialchars");
const utils = require("utils");
const logger = require("logger");
const auth = require("auth");
const authExcludedPaths = ["/authenticate", "/"];

route.use((req, res, next) => {
    if (authExcludedPaths.includes(req.path)) {
        return next();
    }

    const vine_session_id = req.headers["vine-session-id"];
    const vine_client = req.headers["x-vine-client"] || "";

    if (!vine_session_id || !vine_client) {
        return utils.generateError(res, 401, 103, "Authenticate first");
    }

    auth.validateToken(vine_client, vine_session_id, req, res, next);
});


// [POST] Account Creation
route.post("/", async (req, res) => {
    const vine_client = req.headers["x-vine-client"] || "";
    const { username, email, password } = req.body;

    try {
        const userRow = await knex("users")
            .select("id")
            .where("email", email)
            .first();
        
        if (userRow) {
            return utils.generateError(res, 401, 101, "An account with that email address already exists.");
        }

        const hashedPassword = await auth.hashPassword(password);

        const [id] = await knex("users").insert({
            username: username,
            password: hashedPassword,
            email: email
        });

        const token = utils.generateToken();
        await knex("tokens").insert({
            user_id: id,
            token: token,
            vine_client: vine_client
        });

        res.json({
            code: "",
            data: {
                username: username,
                userId: id,
                key: token
            },
            success: true,
            error: ""
        });
    } catch (err) {
        return utils.generateError(res, 500, 420, "Please try again later.");
    }
});

// [POST] Login
route.post("/authenticate", async (req, res) => {
    const vine_client = req.headers["x-vine-client"] || "";
    const { username, password } = req.body;

    try {
        const userRow = await knex("users")
            .select("id", "username", "password", "avatar_url")
            .where("email", username)
            .first();
        
        if (!userRow) {
            return utils.generateError(res, 401, 101, "That username or password is incorrect.");
        }

        if (auth.verifyPassword(password, userRow.password)) {
            let token;

            const tokenRow = await knex("tokens")
                .select("*")
                .where("user_id", userRow.id)
                .where("vine_client", vine_client)
                .first();

            if (tokenRow) {
                token = tokenRow.token;
            } else {
                token = utils.generateToken();
                await knex("tokens").insert({
                    user_id: userRow.id,
                    token: token,
                    vine_client: vine_client
                });
            }

            res.json({
                code: "",
                data: {
                    username: userRow.username,
                    userId: userRow.id,
                    avatarUrl: userRow.avatar_url,
                    key: token
                },
                success: true,
                error: ""
            });
        } else {
            return utils.generateError(res, 401, 101, "That username or password is incorrect.");
        }
    } catch (err) {
        return utils.generateError(res, 500, 420, "Please try again later.");
    }
});

// [DELETE] Log Out
route.delete("/authenticate", async (req, res) => {
    const vine_session_id = req.headers["vine-session-id"];
    const vine_client = req.headers["x-vine-client"] || "";

    if (!vine_session_id) {
        return utils.generateError(res, 401, 103, "Authenticate first");
    }

    try {
        const tokenRow = await knex("tokens")
            .select("*")
            .where("token", vine_session_id)
            .where("vine_client", vine_client)

        if (!tokenRow) {
            return utils.generateError(res, 401, 103, "Authenticate first");
        }

        await knex("tokens")
            .where("token", vine_session_id)
            .where("vine_client", vine_client)
            .del();

        return utils.generateSuccess(res);
    } catch (err) {
        logger.error(err);
        return utils.generateError(res, 500, 420, "Please try again later.");
    }
});

// [POST] Reset Password
route.get("/forgotPassword", (req, res) => {
    res.send("forgotten password endpoint");
});

// [GET] Current User Details
route.get("/me", async (req, res) => {
    res.setHeader("Content-Type", "application/json");
    const vine_session_id = req.headers["vine-session-id"];
    const vine_client = req.headers["x-vine-client"] || "";

    if (!vine_session_id) {
        return utils.generateError(res, 401, 103, "Authenticate first");
    }

    try {
        const tokenRow = req.user;

        if (!tokenRow) {
            return utils.generateError(res, 401, 103, "Authenticate first");
        }

        const userRow = await knex("users")
            .select(
                "id", "username", "avatar_url", "bio", "background_color",
                "location", "email", "verified", "is_explicit", "edition", "disable_address_book",
                "accepts_out_of_network_conversations", "upload_hd_videos", "twitter_oauth_token",
                "twitter_hidden", "is_private"
            )
            .where("id", tokenRow.user_id)
            .first();

        if (!userRow) {
            return utils.generateError(res, 404, 900, "That record does not exist.");
        }

        const [
            loopCount,
            postCount,
            followingCount,
            followersCount,
            likeCount
        ] = await Promise.all([
            knex("videos").sum("loops as total").where("user_id", userRow.id).first(),
            knex("videos").count("* as count").where("user_id", userRow.id).first(),
            knex("follows").count("* as count").where("follow_from", userRow.id).first(),
            knex("follows").count("* as count").where("follow_to", userRow.id).first(),
            knex("likes").count("* as count").where("user_id", userRow.id).first()
        ]);

        const twitterConnected =
            vine_client.toLowerCase().includes("android")
                ? userRow.twitter_oauth_token !== null ? 1 : 0
                : userRow.twitter_oauth_token !== null;

        const responseData = {
            code: "",
            data: {
                avatarUrl: htmlspecialchars(userRow.avatar_url),
                authoredPostCount: parseInt(postCount.count),
                acceptsOutOfNetworkConversations: userRow.accepts_out_of_network_conversations,
                blocked: 0,
                verifiedInformation: 1,
                blocking: 0,
                disableAddressBook: !!userRow.disable_address_book,
                edition: userRow.edition,
                explicit: userRow.is_explicit,
                external: false,
                followStatus: 0,
                followerCount: parseInt(followersCount.count),
                following: 1,
                twitterConnected: twitterConnected,
                twitterId: 824648945720,
                followingCount: parseInt(followingCount.count),
                followingOnTwitter: false,
                friendIndex: 0,
                hiddenEmail: false,
                hiddenPhoneNumber: false,
                hiddenTwitter: parseInt(userRow.twitter_hidden),
                includePromoted: 0,
                likeCount: parseInt(likeCount.count),
                location: htmlspecialchars(userRow.location || "", "ENT_NOQUOTES"),
                loopCount: parseInt(loopCount.total || 0),
                notifyPosts: true,
                orderId: null,
                phoneNumber: null,
                uploadHD: userRow.upload_hd_videos,
                postCount: parseInt(postCount.count),
                privateAccount: userRow.is_private,
                profileBackground: userRow.background_color,
                repostsEnabled: 1,
                secondaryColor: "0x000000",
                key: htmlspecialchars(vine_session_id),
                deviceToken: htmlspecialchars(vine_session_id),
                userId: userRow.id,
                username: htmlspecialchars(userRow.username),
                email: htmlspecialchars(userRow.email),
                description: htmlspecialchars(userRow.bio || "", "ENT_NOQUOTES"),
                verified: parseInt(userRow.verified)
            },
            success: true
        };

        return res.json(responseData);
    } catch (err) {
        logger.error(err);
        return utils.generateError(res, 500, 420, "Please try again later.");
    }
});

// [PUT] Settings
route.put("/:user_id", async (req, res) => {
    const vine_client = req.headers["x-vine-client"] || "";
    const tokenRow = req.user;

    if (!tokenRow) {
        return utils.generateError(res, 401, 103, "Authenticate first");
    }

    const updateFields = {};

    if (req.body.username !== undefined) {
        const trimmed = req.body.username.trim();
        if (trimmed === "") return utils.generateError(res, 400, 105, "Name cannot be empty.");
        if (trimmed.length > 40) return utils.generateError(res, 400, 105, "Name too long.");
        updateFields.username = trimmed;
    }

    if (req.body.description !== undefined) {
        const trimmed = req.body.description.trim();
        if (trimmed.length > 140) return utils.generateError(res, 400, 105, "Description must be at most 140 characters.");
        updateFields.bio = trimmed;
    }

    if (req.body.location !== undefined) {
        const trimmed = req.body.location.trim();
        if (trimmed.length > 30) return utils.generateError(res, 400, 105, "Location must be at most 30 characters.");
        updateFields.location = trimmed;
    }

    if (req.body.phoneNumber !== undefined) {
        const number = Number(req.body.phoneNumber);
        updateFields.phone_number = number;
    }

    if (req.body.avatarUrl !== undefined) {
        const trimmed = req.body.avatarUrl.trim();
        updateFields.avatar_url = trimmed;
    }

    if (Object.keys(updateFields).length === 0) {
        return utils.generateError(res, 400, 105, "No fields provided to update.");
    }

    try {
        await knex("users")
            .where({ id: tokenRow.user_id })
            .update(updateFields);

        const userRow = await knex("users")
        .select(
            "id", "username", "avatar_url", "bio", "background_color",
            "location", "email", "verified", "is_explicit", "edition", "disable_address_book",
            "accepts_out_of_network_conversations", "upload_hd_videos", "twitter_oauth_token",
            "twitter_hidden", "is_private"
        )
        .where("id", tokenRow.user_id)
        .first();

        const [
            loopCount,
            postCount,
            followingCount,
            followersCount,
            likeCount
        ] = await Promise.all([
            knex("videos").sum("loops as total").where("user_id", userRow.id).first(),
            knex("videos").count("* as count").where("user_id", userRow.id).first(),
            knex("follows").count("* as count").where("follow_from", userRow.id).first(),
            knex("follows").count("* as count").where("follow_to", userRow.id).first(),
            knex("likes").count("* as count").where("user_id", userRow.id).first(),
            knex("follows").count("* as count").where("follow_from", tokenRow.user_id).where("follow_to", userRow.id).first()
        ]);

        const twitterConnected =
            vine_client.toLowerCase().includes("android")
                ? userRow.twitter_oauth_token !== null ? 1 : 0
                : userRow.twitter_oauth_token !== null;

        const responseData = {
            code: "",
            data: {
                avatarUrl: htmlspecialchars(userRow.avatar_url),
                authoredPostCount: parseInt(postCount.count),
                acceptsOutOfNetworkConversations: userRow.accepts_out_of_network_conversations,
                blocked: 0,
                verifiedInformation: 1,
                blocking: 0,
                disableAddressBook: !!userRow.disable_address_book,
                edition: userRow.edition,
                explicit: userRow.is_explicit,
                external: false,
                followStatus: 0,
                followerCount: parseInt(followersCount.count),
                following: 1,
                twitterConnected: twitterConnected,
                twitterId: 824648945720,
                followingCount: parseInt(followingCount.count),
                followingOnTwitter: false,
                friendIndex: 0,
                hiddenEmail: false,
                hiddenPhoneNumber: false,
                hiddenTwitter: parseInt(userRow.twitter_hidden),
                includePromoted: 0,
                likeCount: parseInt(likeCount.count),
                location: htmlspecialchars(userRow.location || "", "ENT_NOQUOTES"),
                loopCount: parseInt(loopCount.total || 0),
                notifyPosts: true,
                orderId: null,
                phoneNumber: null,
                uploadHD: userRow.upload_hd_videos,
                postCount: parseInt(postCount.count),
                privateAccount: userRow.is_private,
                profileBackground: userRow.background_color,
                repostsEnabled: 1,
                secondaryColor: "0x000000",
                key: htmlspecialchars(tokenRow.token),
                deviceToken: htmlspecialchars(tokenRow.token),
                userId: userRow.id,
                username: htmlspecialchars(userRow.username),
                email: htmlspecialchars(userRow.email),
                description: htmlspecialchars(userRow.bio || "", "ENT_NOQUOTES"),
                verified: parseInt(userRow.verified)
            },
            success: true
        };

        return res.json(responseData);
    } catch (err) {
        logger.error(err);
        return utils.generateError(res, 500, 420, "Please try again later.");
    }
});

// [GET] User Profile
route.get("/profiles/:user_id", async (req, res) => {
    const vine_client = req.headers["x-vine-client"] || "";
    const tokenRow = req.user;

    if (!tokenRow) {
        return utils.generateError(res, 401, 103, "Authenticate first");
    }

    try {

        const userRow = await knex("users")
            .select(
                "id", "username", "avatar_url", "bio", "background_color",
                "location", "email", "verified", "is_explicit", "edition", "disable_address_book",
                "accepts_out_of_network_conversations", "upload_hd_videos", "twitter_oauth_token",
                "twitter_hidden", "is_private"
            )
            .where("id", req.params.user_id)
            .first();

        if (!userRow) {
            return utils.generateError(res, 404, 900, "That record does not exist.");
        }

        const [
            loopCount,
            postCount,
            followingCount,
            followersCount,
            likeCount,
            following
        ] = await Promise.all([
            knex("videos").sum("loops as total").where("user_id", userRow.id).first(),
            knex("videos").count("* as count").where("user_id", userRow.id).first(),
            knex("follows").count("* as count").where("follow_from", userRow.id).first(),
            knex("follows").count("* as count").where("follow_to", userRow.id).first(),
            knex("likes").count("* as count").where("user_id", userRow.id).first(),
            knex("follows").count("* as count").where("follow_from", tokenRow.user_id).where("follow_to", userRow.id).first()
        ]);

        const twitterConnected =
            vine_client.toLowerCase().includes("android")
                ? userRow.twitter_oauth_token !== null ? 1 : 0
                : userRow.twitter_oauth_token !== null;

        const responseData = {
            code: "",
            data: {
                avatarUrl: htmlspecialchars(userRow.avatar_url),
                authoredPostCount: parseInt(postCount.count),
                acceptsOutOfNetworkConversations: userRow.accepts_out_of_network_conversations,
                blocked: 0,
                verifiedInformation: 1,
                blocking: 0,
                disableAddressBook: !!userRow.disable_address_book,
                edition: userRow.edition,
                explicit: userRow.is_explicit,
                external: false,
                followStatus: parseInt(following.count),
                followerCount: parseInt(followersCount.count),
                following: parseInt(following.count),
                twitterConnected: twitterConnected,
                twitterId: 824648945720,
                followingCount: parseInt(followingCount.count),
                followingOnTwitter: false,
                friendIndex: 0,
                hiddenEmail: false,
                hiddenPhoneNumber: false,
                hiddenTwitter: parseInt(userRow.twitter_hidden),
                includePromoted: 0,
                likeCount: parseInt(likeCount.count),
                location: htmlspecialchars(userRow.location || "", "ENT_NOQUOTES"),
                loopCount: parseInt(loopCount.total || 0),
                notifyPosts: true,
                orderId: null,
                phoneNumber: null,
                uploadHD: userRow.upload_hd_videos,
                postCount: parseInt(postCount.count),
                privateAccount: userRow.is_private,
                profileBackground: userRow.background_color,
                repostsEnabled: 1,
                secondaryColor: "0x000000",
                userId: userRow.id,
                username: htmlspecialchars(userRow.username),
                email: htmlspecialchars(userRow.email),
                description: htmlspecialchars(userRow.bio || "", "ENT_NOQUOTES"),
                verified: parseInt(userRow.verified)
            },
            success: true
        };

        return res.json(responseData);
    } catch (err) {
        logger.error(err);
        return utils.generateError(res, 500, 420, "Please try again later.");
    }
});

// [GET] Followers
route.get("/:user_id/followers", async (req, res) => {
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

        const rows = await knex("follows")
        .select("*")
        .where("follow_to", userId)
        .orderBy("id", "desc")
        .limit(perPage)
        .offset(offset);

        response.data.count = rows.length;
        response.size = rows.length;

        for (const row of rows) {
            const viewerId = tokenRow.user_id;
            const followerId = row.follow_from;

            const urow = await knex("users")
            .select(
                "username",
                "avatar_url",
                "verified",
                "location",
                "is_private",
                knex.raw(
                "(SELECT COUNT(*) FROM follows WHERE follow_from = ? AND follow_to = users.id) AS following",
                [viewerId]
                )
            )
            .where("id", followerId)
            .first();

            const user = {
                username: urow.username,
                verified: urow.verified,
                vanityUrls: [],
                avatarUrl: urow.avatar_url,
                userId: followerId,
                following: urow.following,
                user: {
                    private: urow.is_private
                },
                location: urow.location
            };

            response.data.records.push(user);
        }
    } catch (err) {
        response.success = false;
        response.error = err.message;
    }
    res.send(response);
});

// [GET] Following
route.get("/:user_id/following", async (req, res) => {
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

        const rows = await knex("follows")
        .select("*")
        .where("follow_from", userId)
        .orderBy("id", "desc")
        .limit(perPage)
        .offset(offset);

        response.data.count = rows.length;
        response.size = rows.length;

        for (const row of rows) {
            const viewerId = tokenRow.user_id;
            const followingId = row.follow_to;

            const urow = await knex("users")
            .select(
                "username",
                "avatar_url",
                "verified",
                "location",
                "is_private",
                knex.raw(
                "(SELECT COUNT(*) FROM follows WHERE follow_from = ? AND follow_to = users.id) AS following",
                [viewerId]
                )
            )
            .where("id", followingId)
            .first();

            const user = {
                username: urow.username,
                verified: urow.verified,
                vanityUrls: [],
                avatarUrl: urow.avatar_url,
                userId: followingId,
                following: urow.following,
                user: {
                    private: urow.is_private
                },
                location: urow.location
            };

            response.data.records.push(user);
        }
    } catch (err) {
        response.success = false;
        response.error = err.message;
    }
    res.send(response);
});

// [POST] Follow User
route.post("/:user_id/followers", async (req, res) => {
    const userId = req.params.user_id;

    try {
        const tokenRow = req.user;

        if (!tokenRow) {
            return utils.generateError(res, 401, 103, "Authenticate first");
        }

        const isFollowing = await knex("follows")
        .select("id")
        .where("follow_from", tokenRow.user_id)
        .where("follow_to", userId)
        .first();
        
        if(isFollowing) {
            return utils.generateSuccess(res);
        } else {
            await knex("follows").insert({
                follow_from: tokenRow.user_id,
                follow_to: userId
            })

            return utils.generateSuccess(res);
        }
    } catch (err) {
        return utils.generateError(res, 500, 420, "Please try again later.");
    }
});

// [DELETE] Unfollow User
route.delete("/:user_id/followers", async (req, res) => {
    const userId = req.params.user_id;

    try {
        const tokenRow = req.user;

        if (!tokenRow) {
            return utils.generateError(res, 401, 103, "Authenticate first");
        }

        const isFollowing = await knex("follows")
        .select("id")
        .where("follow_from", tokenRow.user_id)
        .where("follow_to", userId)
        .first();
        
        if(isFollowing) {
            await knex("follows")
            .where("follow_from", tokenRow.user_id)
            .where("follow_to", userId)
            .del();

            return utils.generateSuccess(res);
        } else {
            await knex("follows").insert({
                follow_from: tokenRow.user_id,
                follow_to: userId
            })

            return utils.generateSuccess(res);
        }
    } catch (err) {
        return utils.generateError(res, 500, 420, "Please try again later.");
    }
});

// [GET] Search
route.get("/search/:query", async (req, res) => {
    const query = req.params.query;
    const sanitizedQuery = query.replace(/[%_]/g, "\\$&");
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

        const rows = await knex("users")
        .select(
            "id",
            "username",
            "avatar_url",
            "verified",
            "location",
            "is_private",
            knex.raw(
                "(SELECT COUNT(*) FROM follows WHERE follow_from = ? AND follow_to = users.id) AS following",
                [tokenRow.user_id]
            )
        )
        .where("username", "like", `%${sanitizedQuery}%`)
        .orderBy("id", "desc")
        .limit(perPage)
        .offset(offset);

        response.data.count = rows.length;
        response.size = rows.length;

        for (const row of rows) {
            const user = {
                username: row.username,
                verified: row.verified,
                vanityUrls: [],
                avatarUrl: row.avatar_url,
                userId: row.id,
                following: row.following,
                user: {
                    private: row.is_private
                },
                location: row.location
            };

            response.data.records.push(user);
        }
    } catch (err) {
        response.success = false;
        response.error = err.message;
    }
    res.send(response);
});

module.exports = route;