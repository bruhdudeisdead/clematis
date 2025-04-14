module.exports = [
    {
        path: "/users",
        route: require("./api/users.js")
    },
    {
        path: "/timelines",
        route: require("./api/timelines.js")
    },
    {
        path: "/posts",
        route: require("./api/posts.js")
    },
    {
        path: "/upload",
        route: require("./api/upload.js")
    },
    {
        path: "/tags",
        route: require("./api/tags.js")
    },
    {
        path: "/search",
        route: require("./api/search.js")
    },
    {
        path: "/channels",
        route: require("./api/channels.js")
    },
    {
        path: "/recommendations",
        route: require("./api/recommendations.js")
    }
]