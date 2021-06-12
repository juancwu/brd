const { Downloader, DOWNLOADER_EVENTS } = require("./../Downloader");

let daemon = null;

function disconnect() {
  if (daemon) {
    if (!daemon.__running) {
      // only kill when download is completed or not started
      process.kill(process.pid);
    }
  } else if (process.kill(process.pid, 0)) {
    //   procress is running
    // kill proccess due to error
    process.kill(process.pid);
  }
}

function start(metadata) {
  daemon = new Daemon();
  // by default, the Downloader only emits an error event but does not reject.
  // setting this to true, it will only reject and not emit error event.
  metadata["rejectOnError"] = true;
  daemon.start(metadata);
}

function Daemon() {
  this.__running = false;
}

Daemon.prototype.start = function (metadata) {
  const _daemon = this;

  _daemon.__running = true;

  const downloader = new Downloader(metadata);

  downloader.on(DOWNLOADER_EVENTS.PROGRESS, (stats) => {
    let concat = `Progress: ${stats.progress} - Downloaded: ${stats.downloaded} - Total: ${stats.total}`;
    process.send({
      error: null,
      pid: process.pid,
      message: concat,
    });
  });

  downloader
    .start()
    .then((done) => {
      if (done) {
        process.send({
          error: null,
          pid: process.pid,
          message: "Downloader daemon download completed.",
        });
      }
      _daemon.__running = false;
      disconnect();
    })
    .catch((e) => {
      process.send({
        error: e,
        pid: process.pid,
        message: "Downloader daemon error.",
      });
      process.kill(process.pid);
      _daemon.__running = false;
      disconnect();
    });
};

process.once("message", start);

process.once("disconnect", disconnect);
