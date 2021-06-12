const { Downloader, DOWNLOADER_EVENTS } = require("./../Downloader");

let daemon = null;
let timeout = null;

function disconnect() {
  if (daemon) {
    if (!daemon.__running) {
      // only kill when download is completed or not started
      process.kill(process.pid);
    } else {
      // set a time interval to check if the daemon is still running or not to kill
      // the process. If an error occurs while being disconnected from master process,
      // the subprocess will catch the error and kill itself.
      timeout = setTimeout(() => {
        clearTimeout(timeout);
        disconnect();
      }, 5000);
    }
  }
}

function start(metadata) {
  daemon = new Daemon();
  // by default, the Downloader only emits an error event but does not reject.
  // setting this to true, it will only reject and not emit error event.
  metadata["rejectOnError"] = true;
  daemon.start(metadata);
}

function send(data) {
  if (process.connected) {
    process.send(data);
  }
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
    send({
      error: null,
      pid: process.pid,
      message: concat,
    });
  });

  downloader
    .start()
    .then((done) => {
      if (done) {
        send({
          error: null,
          pid: process.pid,
          message: "Downloader daemon download completed.",
        });
      }
      _daemon.__running = false;
      disconnect();
    })
    .catch((e) => {
      send({
        error: e,
        pid: process.pid,
        message: "Downloader daemon error.",
      });
      _daemon.__running = false;
      disconnect();
    });
};

process.once("message", start);

process.once("disconnect", disconnect);
