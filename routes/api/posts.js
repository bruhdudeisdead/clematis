const express = require("express");
const route = express.Router();
const knex = require("db");
const storage = require("storage");
const utils = require("utils");
const logger = require("logger");
const auth = require("auth");

route.use((req, res, next) => {
  const vine_session_id = req.headers["vine-session-id"];
  const vine_client = req.headers["x-vine-client"] || "";

  if (!vine_session_id || !vine_client) {
      return utils.generateError(res, 401, 103, "Authenticate first");
  }

  auth.validateToken(vine_client, vine_session_id, req, res, next);
});

route.get("/", (req, res) => {
  res.send("/posts");
});

// [POST] Create Post
route.post("/", async (req, res) => {
  try {
    const tokenRow = req.user;
          
    if (!tokenRow) {
        return utils.generateError(res, 401, 103, "Authenticate first");
    }
    
    const videoUrl = req.body.videoUrlWebm ?? req.body.videoUrl ?? "";
    const videoBuffer = await utils.getVideoBuffer(videoUrl);

    const thumbnail = await utils.generateThumbnail(videoBuffer, "thumb.png");
    const thumbnailUrl = await storage.saveFile(thumbnail, "thumbnails");

    const description = req.body.description ?? "";
    let entities = [];
    if (req.body.entities) {
      try {
        entities = JSON.parse(req.body.entities);
        if (!Array.isArray(entities)) {
          entities = [];
        }
      } catch (err) {
        entities = [];
      }
    }

    const channelId = req.body.channelId ?? 0;

    const venueId = req.body.foursquareVenueId ?? null;
    const venueName = req.body.venueName ?? req.body.foursquareVenueName ?? "";

    const snowflakeId = utils.generateSnowflake();
    const shareId = utils.generateShareId();
    const userId = tokenRow.user_id;

    const tagRegex = /#(\w+)/gu;
    const tagMatches = [...description.matchAll(tagRegex)];

    const tagEntities = [];

    for (const match of tagMatches) {
      const tag = match[1];
      const tagStart = match.index;
      const tagRange = [tagStart, tagStart + tag.length + 1];

      const rows = await knex("tags")
        .select("id", "post_count")
        .where("tag", tag);

      if (rows.length === 0) {
        await knex("tags").insert({
          tag: tag
        });
      } else {
        const tagRow = rows[0];
        const newCount = tagRow.post_count + 1;
        await knex("tags")
          .where("id", tagRow.id)
          .update({
              post_count: newCount,
              last_used: knex.fn.now()
          });
      }

      tagEntities.push({
        type: "tag",
        range: tagRange,
        link: "vine://tag/" + tag,
        id: 0,
        title: tag
      });
    }

    const mentionRegex = /@(\w+)/gu;
    const mentionMatches = [...description.matchAll(mentionRegex)];

    entities = [];

    for (const match of mentionMatches) {
      const mention = match[1];
      const mentionStart = match.index;
      const mentionRange = [mentionStart, mentionStart + mention.length + 1];

      const rows = await knex("users")
        .select("id")
        .where("username", mention)

      const mentionId = rows[0]?.id ?? 0;

      entities.push({
        type: "mention",
        id: mentionId,
        text: mention,
        range: mentionRange
      });
    }

    entities.push(...tagEntities);

    if(userId && videoUrl && thumbnailUrl) {
      await knex("videos").insert({
          id: snowflakeId,
          share_id: shareId,
          video_url: videoUrl,
          thumbnail_url: thumbnailUrl,
          description: description,
          entities: JSON.stringify(entities),
          user_id: userId,
          venue_id: venueId,
          venue_name: venueName,
          channel_id: channelId
      });

      return utils.generateSuccess(res);
    } else {
      logger.error("Invalid input data", { userId, videoUrl, thumbnailUrl });
      return utils.generateError(res, 400, 105, "Invalid input data.");
    }
  } catch (err) {
    logger.error("Error processing video:", err.message);
    console.error(err);
    return utils.generateError(res, 500, 106, "Failed to process video");
  }
})

// [GET] Get Post Likes
route.get("/:id/likes", async (req, res) => {
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
    
    if(!tokenRow) {
      return utils.generateError(res, 401, 103, "Authenticate first");
    }

    const post = await knex("videos")
      .select("id")
      .where("id", req.params.id)
      .first();

    if(!post) {
      return utils.generateError(res, 404, 900, "That record doesn't exist.");
    }

    const rows = await knex("likes")
      .select("*")
      .where("video_id", req.params.id)
      .orderBy("created_at", "desc")
      .limit(perPage)
      .offset(offset);

    response.data.count = rows.length;
    response.size = rows.length;

    for (const row of rows) {

        const urow = await knex("users")
        .select(
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
        .where("id", row.user_id)
        .first();

        const user = {
            username: urow.username,
            verified: urow.verified,
            vanityUrls: [],
            avatarUrl: urow.avatar_url,
            userId: row.user_id,
            following: urow.following,
            user: {
                private: urow.is_private
            },
            location: urow.location
        };

        response.data.records.push(user);
    }

    res.send(response);
  } catch (err) {
    logger.error(err);
    return utils.generateError(res, 500, 420, "Please try again later.");
  }
})

// [POST] Like Post
route.post("/:id/likes", async (req, res) => {
  const postId = BigInt(req.params.id);
  try {
    const tokenRow = req.user;
    
    if(!tokenRow) {
      return utils.generateError(res, 401, 103, "Authenticate first");
    }

    const post = await knex("videos")
      .select("id")
      .where("id", postId)
      .first();

    if(!post) {
      return utils.generateError(res, 404, 900, "That record doesn't exist.");
    }

    const alreadyLiked = await knex("likes")
      .select("id")
      .where("user_id", tokenRow.user_id)
      .where("video_id", postId)
      .first();

    if(alreadyLiked) {
      return utils.generateSuccess(res);
    }

    await knex("likes").insert({
      user_id: tokenRow.user_id,
      video_id: postId
    })

    return utils.generateSuccess(res);
  } catch (err) {
    logger.error(err);
    return utils.generateError(res, 500, 420, "Please try again later.");
  }
})

// [DELETE] Unlike Post
route.delete("/:id/likes", async (req, res) => {
  const postId = BigInt(req.params.id);
  try {
    const tokenRow = req.user;
    
    if(!tokenRow) {
      return utils.generateError(res, 401, 103, "Authenticate first");
    }

    const post = await knex("videos")
      .select("id")
      .where("id", postId)
      .first();

    if(!post) {
      return utils.generateError(res, 404, 900, "That record doesn't exist.");
    }

    await knex("likes")
      .where("video_id", postId)
      .where("user_id", tokenRow.user_id)
      .del();

    return utils.generateSuccess(res);
  } catch (err) {
    logger.error(err);
    return utils.generateError(res, 500, 420, "Please try again later.");
  }
})

module.exports = route;