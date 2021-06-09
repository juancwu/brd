const { Downloader, DOWNLOADER_EVENTS } = require("./../Downloader");

let daemon = null;

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
    })
    .catch((e) => {
      process.send({
        error: e,
        pid: process.pid,
        message: "Downloader daemon error.",
      });
      process.kill(process.pid);
    });
};

process.once("message", (metadata) => {
  daemon = new Daemon();
  daemon.start(metadata);
});

process.once("disconnect", () => {
  if (daemon) {
    if (!daemon.__running) {
      process.kill(process.pid);
    }
  } else if (process.kill(process.pid, 0)) {
    //   procress is running
    process.kill(process.pid);
  }
});
