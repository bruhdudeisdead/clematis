const express = require("express");
const route = express.Router();
const knex = require("db");
const htmlspecialchars = require("htmlspecialchars");
const auth_sample = require('../../sampledata/auth.json');
const utils = require("utils");
const auth = require("auth");

// [POST] Account Creation
route.get("", (req, res) => {
    res.send("/users");
});

// [POST] Login
route.post("/authenticate", async (req, res) => {
    const vine_client = req.headers["vine-client"] || "";
    const { username, password } = req.body;

    try {
        const userRow = await knex("users")
            .select("id", "username", "password", "avatar_url")
            .where("email", username)
            .first();
        
        if (!userRow) {
            return utils.generateError(401, 101, "That username or password is incorrect.");
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
            return utils.generateError(401, 101, "That username or password is incorrect.");
        }
    } catch (err) {
        return utils.generateError(500, 420, "Please try again later.");
    }
});

// [DELETE] Log Out
route.delete("/authenticate", async (req, res) => {
    const vine_session_id = req.headers["vine-session-id"];
    const vine_client = req.headers["vine-client"] || "";

    if (!vine_session_id) {
        return utils.generateError(401, 103, "Authenticate first");
    }

    try {
        const tokenRow = await knex("tokens")
            .select("*")
            .where("token", vine_session_id)
            .first();

        if (!tokenRow) {
            return utils.generateError(401, 103, "Authenticate first");
        }

        await knex("tokens")
            .where("token", vine_session_id)
            .del();

        return utils.generateSuccess(res);
    } catch (err) {
        console.error(err);
        return utils.generateError(500, 420, "Please try again later.");
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
    const vine_client = req.headers["vine-client"] || "";

    if (!vine_session_id) {
        utils.generateError(401, 103, "Authenticate first");
        return;
    }

    auth.validateToken(vine_client, vine_session_id);

    try {
        const tokenRow = await knex("tokens")
            .select("*")
            .where("token", vine_session_id)
            .first();

        if (!tokenRow) {
            utils.generateError(401, 103, "Authenticate first");
            return;
        }

        const userRow = await knex("users")
            .select(
                "id", "username", "screen_name", "avatar_url", "bio", "profileBackground",
                "location", "email", "verified", "is_explicit", "edition", "disable_address_book",
                "accepts_out_of_network_conversations", "upload_hd_videos", "twitter_oauth_token",
                "twitter_hidden", "is_private"
            )
            .where("id", tokenRow.user_id)
            .first();

        if (!userRow) {
            utils.generateError(404, 900, "That record does not exist.");
            return;
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
                location: htmlspecialchars(userRow.location || "Not set.", "ENT_NOQUOTES"),
                loopCount: parseInt(loopCount.total || 0),
                notifyPosts: true,
                orderId: null,
                phoneNumber: null,
                uploadHD: userRow.upload_hd_videos,
                postCount: parseInt(postCount.count),
                privateAccount: userRow.is_private,
                profileBackground: userRow.profileBackground,
                repostsEnabled: 1,
                secondaryColor: "0x00FFB2",
                key: htmlspecialchars(vine_session_id),
                deviceToken: htmlspecialchars(vine_session_id),
                userId: userRow.id,
                username: htmlspecialchars(userRow.screen_name),
                email: htmlspecialchars(userRow.email),
                description: htmlspecialchars(userRow.bio || "Not set.", "ENT_NOQUOTES"),
                verified: parseInt(userRow.verified)
            },
            success: true
        };

        return res.json(responseData);
    } catch (err) {
        console.error(err);
        utils.generateError(500, 420, "Please try again later.");
        return;
    }
});

// [GET] User Profile
route.get("/profiles/:user_id", async (req, res) => {
    res.setHeader("Content-Type", "application/json");
    const userId = req.params.user_id;
    const vine_session_id = req.headers["vine-session-id"];
    const vine_client = req.headers["vine-client"] || "";

    if (!vine_session_id) {
        utils.generateError(401, 103, "Authenticate first");
        return;
    }

    try {

        const userRow = await knex("users")
            .select(
                "id", "username", "screen_name", "avatar_url", "bio", "profileBackground",
                "location", "email", "verified", "is_explicit", "edition", "disable_address_book",
                "accepts_out_of_network_conversations", "upload_hd_videos", "twitter_oauth_token",
                "twitter_hidden", "is_private"
            )
            .where("id", req.params.user_id)
            .first();

        if (!userRow) {
            utils.generateError(404, 900, "That record does not exist.");
            return;
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
                location: htmlspecialchars(userRow.location || "Not set.", "ENT_NOQUOTES"),
                loopCount: parseInt(loopCount.total || 0),
                notifyPosts: true,
                orderId: null,
                phoneNumber: null,
                uploadHD: userRow.upload_hd_videos,
                postCount: parseInt(postCount.count),
                privateAccount: userRow.is_private,
                profileBackground: userRow.profileBackground,
                repostsEnabled: 1,
                secondaryColor: "0x00FFB2",
                key: htmlspecialchars(vine_session_id),
                deviceToken: htmlspecialchars(vine_session_id),
                userId: userRow.id,
                username: htmlspecialchars(userRow.screen_name),
                email: htmlspecialchars(userRow.email),
                description: htmlspecialchars(userRow.bio || "Not set.", "ENT_NOQUOTES"),
                verified: parseInt(userRow.verified)
            },
            success: true
        };

        return res.json(responseData);
    } catch (err) {
        console.error(err);
        utils.generateError(500, 420, "Please try again later.");
        return;
    }
});

module.exports = route;