# clematis
[View web API documentation](https://github.com/bruhdudeisdead/clematis/wiki/api.vineapp.com) • [View app patching guide](https://github.com/bruhdudeisdead/clematis/wiki/Patching)  

A replacement for the Vine mobile application's web APIs, built in Node.js. Heavy work in progress.

<img src="https://github.com/user-attachments/assets/b3acf503-4791-47fe-aba1-e15841be4e3c" height="360" alt="An iPhone 5 running the Vine application connected to a clematis server in the background"> 

# How to use????
Well, you shouldn't yet, because it's still very unfinished and not ready for use whatsoever.  
But for when it is, you need:
- Node.js
- MySQL server
- FFmpeg
- A brain

1. Create a MySQL database, then a user for said database, and import the structure .sql file
2. Create ```config.json``` from ```example.config.json``` and put in your database credentials and whatever else you'd like to configure
3. Install the dependencies by running ```npm install```
4. Start the server by running ```node .```, you can probably use something like PM2 to keep it running but I'm not going to get into that.
5. Verify that it works by going to ```localhost:(the port you set in config.json)``` and see if it says "clematis", or open the app on your device and create an account
## Ummmm...I don't know how to do (...).......
That's a shame.
## What are the "baseUrl" and "postShareUrl" values for in config.json?
"baseUrl" is where your clematis instance is available (and where media will be served from if you are using the local storage mode), and "postShareUrl" would be where your frontend is available, and where posts can be viewed.  
So, for example, I have a clematis instance at "clematis.example.com". I would set "baseUrl" to "https://clematis.example.com/". Then, I have a frontend at "app.example.com". I would set "postShareUrl" to "https://app.example.com/v/", or whatever I set the post page's path to.  
Now, when I upload a video, the media URL will be "https://clematis.example.com/uploads/videos/example.mp4", and when I share a post via URL, the URL given will be "https://app.example.com/v/a1B2c3D4" (or whatever the post's share ID is).
## Frontend?
Make your own.
# Why is it called clematis?
Because clematis is a type of vine.
