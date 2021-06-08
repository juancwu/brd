const express = require("express");
const { Downloader, DOWNLOADER_EVENTS } = require("./Downloader");
const path = require("path");
const Bookmark = require("./Bookmark");

const app = express();
const bookmark = new Bookmark();

bookmark.on("added", (uuid, task) => {
  console.log("Task added to bookmark with uuid: " + uuid);
});

bookmark.on("removed", (uuid) => {
  console.log("Task removed from bookmark with uuid: " + uuid);
});

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.post("/download", (req, res, next) => {
  const { body } = req;

  if (!body) return next(new Error("Empty body."));

  if (!body.url) return next(new Error("Empty body.url"));

  const options = {
    url: body.url,
    destination: path.join(__dirname, "downloads"),
  };

  if (body.filename) {
    options.filename = body.filename;
  }

  if (body.progressThrottle) {
    options.progressThrottle = parseInt(body.progressThrottle);
  }

  if (body.bandwidthThrottle) {
    options.bandwidthThrottle = parseInt(body.bandwidthThrottle);
  }

  const downloader = new Downloader(options);

  downloader.on(DOWNLOADER_EVENTS.PROGRESS, (stats) => {
    console.log(
      `Progress: ${stats.progress} - Downloaded: ${stats.downloaded} - Total: ${stats.total}`
    );
  });

  bookmark.add(downloader, downloader.__options.uid);

  downloader
    .start()
    .then(() => {
      console.log("download completed");
      bookmark.remove(downloader.__options.uid);
    })
    .catch((e) => {
      if (res.headersSent) {
        next(e);
      }
      res.send({ error: e });
    });

  res.send({
    status: "download started...",
    uuid: downloader.__options.uid,
  });
});

app.get("/bookmarks", (req, res) => {
  res.send(bookmark.getAll());
});

const port = process.env.PORT || 3210;

app.listen(port, () => console.log("listening on port: ", port));
