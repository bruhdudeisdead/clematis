const express = require("express");
const config = require("../../config.json");
const knex = require("db");
const auth = require("auth");
const route = express.Router();
const utils = require("utils");
const { DateTime } = require('luxon');
const JSONbig = require("json-bigint")({ useNativeBigInt: true });

route.use((req, res, next) => {
    res.setHeader("Content-Type", "application/json");

    const vine_session_id = req.headers["vine-session-id"];
    const vine_client = req.headers["x-vine-client"] || "";

    if (!vine_session_id || !vine_client) {
        return utils.generateError(res, 401, 103, "Authenticate first");
    }

    auth.validateToken(vine_client, vine_session_id, req, res, next);
});

route.get("/", (req, res) => {
  res.send("/search");
});

// [GET] Search
route.get("/sectioned", async (req, res) => {
    const query = req.query.q;
    const sanitizedQuery = query.replace(/[%_]/g, "\\$&");

    const response = {
        code: "",
        data: {
            results: [
              {
                users: {
                  records: [],
                  displayCount: 0
                },
              },
              {
                tags: {
                  records: [],
                  displayCount: 0
                },
              },
              {
                channels: {
                  records: [],
                  displayCount: 0
                },
              },
              {
                posts: {
                  records: [],
                  displayCount: 0
                },
              },
            ]
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

        // users
        const userRows = await knex("users")
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
            ),
            knex.raw(
                "(SELECT COUNT(*) FROM videos WHERE user_id = users.id) AS post_count",
            )
        )
        .where("username", "like", `%${sanitizedQuery}%`)
        .orderBy("id", "desc")
        .limit(20)

        response.data.results[0].users.displayCount = userRows.length;

        for (const userRow of userRows) {
            const user = {
                username: userRow.username,
                verified: userRow.verified,
                vanityUrls: [],
                avatarUrl: userRow.avatar_url,
                userId: userRow.id,
                following: userRow.following,
                
                location: userRow.location
            };

            response.data.results[0].users.records.push(user);
        }

        // tags
        const tagRows = await knex("tags")
        .select(
            "id",
            "tag",
        )
        .where("tag", "like", `%${sanitizedQuery}%`)
        .orderBy("id", "desc")
        .limit(20)

        response.data.results[1].tags.displayCount = tagRows.length;

        for (const tagRow of tagRows) {
            const tag = {
                tagId: tagRow.id,
                tag: tagRow.tag
            };

            response.data.results[1].tags.records.push(tag);
        }

        // channels
        const channelRows = await knex("channels")
        .select(
            "id",
            "name",
            "icon",
            "icon_retina",
            "bgcolor"
        )
        .where("name", "like", `%${sanitizedQuery}%`)
        .orderBy("id", "desc")
        .limit(20)

        response.data.results[2].channels.displayCount = channelRows.length;

        for (const channelRow of channelRows) {
            const channel = {
                channelId: channelRow.id,
                channel: channelRow.name,
                backgroundColor: channelRow.bgcolor,
                iconUrl: channelRow.icon,
                retinaIconurl: channelRow.icon_retina,
                fullIconUrl: channelRow.icon,
                retinaIconFullUrl: channelRow.icon_retina
            };

            response.data.results[2].channel.records.push(channel);
        }
        
        // posts
        const postRows = await knex("videos")
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
        .where("description", "like", `%${sanitizedQuery}%`)
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
        .limit(20)

      response.data.results[3].posts.displayCount = postRows.length;

      for (const postRow of postRows) {
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
                  "profile_color",
                  knex.raw(
                    "(SELECT COUNT(*) FROM follows WHERE follow_from = ? AND follow_to = users.id) AS following",
                    [tokenRow.user_id]
                  )
              )
              .where("id", postRow.user_id)
              .first();

          const createdAt = new Date(postRow.created_at); 
          const formattedCreatedAt = createdAt.toISOString(); 

          const post = {
              liked: postRow.liked,
              foursquareVenueId: postRow.venue_id,
              userId: postRow.user_id,
              private: 0,
              likes: {
                  count: postRow.like_count,
                  records: []
              },
              loops: {
                  count: Number(postRow.loops),
                  created: formattedCreatedAt,
                  velocity: 0.1,
                  onFire: 0
              },
              thumbnailUrl: postRow.thumbnail_url,
              explicitContent: urow.is_explicit,
              myRepostId: postRow.repost_id,
              vanityUrls: [],
              verified: urow.verified,
              avatarUrl: urow.avatar_url,
              videoUrls: [
                  { format: "h264", rate: 30, videoUrl: postRow.video_url },
                  { format: "webm", rate: 30, videoUrl: postRow.video_url }
              ],
              comments: {
                  count: postRow.comment_count,
                  records: []
              },
              entities: JSON.parse(postRow.entities),
              videoLowURL: postRow.video_url,
              videoPreview: postRow.video_url,
              permalinkUrl: config.urls.postShareUrl + BigInt(postRow.id),
              username: urow.username,
              description: postRow.description,
              postId: BigInt(row.id),
              videoUrl: postRow.video_url,
              created: formattedCreatedAt,
              shareUrl: config.urls.postShareUrl + BigInt(postRow.id),
              following: Number(urow.following),
              user: {
                  userId: Number(postRow.user_id),
                  avatarUrl: urow.avatar_url,
                  description: urow.bio,
                  location: urow.location,
                  username: urow.username,
                  verified: Number(urow.verified),
                  profileBackground: urow.profile_color,
                  following: Number(urow.following),
                  explicitContent: null
              },
              tags: [],
              promoted: postRow.promoted,
              reposts: {
                  count: postRow.repost_count,
                  records: []
              }
          };

          response.data.results[3].posts.records.push(post);
      }
    } catch (err) {
        return utils.generateError(res, 500, 420, `Please try again later. ${err.message}`);
    }
    res.end(JSONbig.stringify(response));
});

module.exports = route;