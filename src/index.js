const express = require("express");
const { Downloader, DOWNLOADER_EVENTS } = require("./Downloader");
const path = require("path");
const Bookmark = require("./Bookmark");

const app = express();
const bookmark = new Bookmark();

bookmark.on("added", (uuid, task) => {
  console.log("Task added to bookmark with uuid: " + uuid);
  console.log(task);
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

  if (typeof body.filename === "string") {
    options.filename = body.filename;
  }

  if (typeof body.progressThrottle !== "undefined") {
    options.progressThrottle = parseInt(body.progressThrottle);
  }

  if (typeof body.bandwidthThrottle !== "undefined") {
    options.bandwidthThrottle = parseInt(body.bandwidthThrottle);
  }

  let downloader = new Downloader(options);

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
      downloader = null;
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

app.post("/cancel", async (req, res, next) => {
  try {
    if (!req.body) {
      return next(new Error("Empty body"));
    }

    if (!req.body.uuid) {
      return next(new Error("No uuid provided"));
    }

    let downloader = bookmark.get(req.body.uuid);

    if (downloader) {
      await downloader.cancel();
      bookmark.remove(uuid);
      downloader = null;
      return res.send({ status: "Download cancelled", uuid });
    } else {
      return next(new Error("No download with id: " + uuid));
    }
  } catch (error) {
    next(error);
  }
});

app.get("/bookmarks", (req, res) => {
  res.send(bookmark.getAll());
});

const port = process.env.PORT || 3210;

app.listen(port, () => console.log("listening on port: ", port));
