const R = require("express").Router();
const constants = require("./../constants");
const { Downloader, DOWNLOADER_EVENTS } = require("./../Downloader");

// root path /download
R.post("/", (req, res, next) => {
  const { body } = req;

  if (!body) return next(new Error("Empty body."));

  if (!body.url) return next(new Error("Empty body.url"));

  const options = {
    url: body.url,
    destination: constants.kDownloadDir,
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

  if (body.daemon) {
    const startedPids = req.app.get('master').start(
      1,
      constants.kDownloaderDaemonDir,
      options
    );
    res.send({ pids: startedPids });
  } else {
    let downloader = new Downloader(options);

    downloader.on(DOWNLOADER_EVENTS.PROGRESS, (stats) => {
        console.log(
          `Progress: ${stats.progress} - Downloaded: ${stats.downloaded} - Total: ${stats.total}`
        );
    });

    downloader.on(DOWNLOADER_EVENTS.ERROR, (err) => {
      console.log("ERROR EVENT");
      console.log(err);
      req.app.get("bookmark").remove(downloader.__options.uuid);
      downloader = null; // free memory
      if (res.headersSent) {
        return next(err);
      }
      res.send({ error: err });
    });

    req.app.get("bookmark").add(downloader, downloader.__options.uuid);

    downloader
      .start()
      .then(() => {
        console.log("download completed");
        req.app.get("bookmark").remove(downloader.__options.uuid);
        downloader = null;
      });

    res.send({
      status: "download started...",
      uuid: downloader.__options.uuid,
    });
  }
});

R.get("/stats", (req, res, next) => {
  const query = req.query;

  if (typeof query.uuid === "undefined") {
    return res.status(400).send({
      code: 400,
      status: "BAD REQUEST",
      message: "No uuid field in querystring",
    });
  }

  let downloader = req.app.get("bookmark").get(query.uuid);

  console.log(downloader);

  if (downloader) {
    let stats = downloader.getStats();
    return res.send({ stats, uuid: query.uuid });
  } else {
    return res.send({
      status: "NOT FOUND",
      message: `No download with uuid: ${query.uuid}`,
    });
  }
});

R.post("/cancel", async (req, res, next) => {
  try {
    if (!req.body) {
      return next(new Error("Empty body"));
    }

    if (!req.body.uuid) {
      return next(new Error("No uuid provided"));
    }

    let downloader = req.app.get("bookmark").get(req.body.uuid);

    if (downloader) {
      await downloader.cancel();
      req.app.get("bookmark").remove(req.body.uuid);
      downloader = null;
      return res.send({ status: "Download cancelled", uuid: req.body.uuid });
    } else {
      return next(new Error("No download with id: " + req.body.uuid));
    }
  } catch (error) {
    next(error);
  }
});

module.exports = R;
