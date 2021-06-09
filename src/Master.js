const { EventEmitter } = require("events");
const { fork } = require("child_process");
const { inherits } = require("util");

const MASTER_EVENTS = {
  SUBPROCESS_MESSAGE: "subprocess_message",
  SUBPROCESS_ERROR: "subprocess_error",
  SUBPROCESS_DISCONNECT: "subprocess_disconnect",
};

function Master() {
  this.__threads = {};
}

inherits(Master, EventEmitter);

/**
 * Starts a new child process
 * @param {number} numOfThreads - number of deamons to start
 * @param {string} daemon - path to daemon script
 * @param {*} metadata - data that the daemon will need to run properly
 * @returns {Array<number>} - Started pids
 */
Master.prototype.start = function (numOfThreads, daemon, metadata) {
  if (!numOfThreads || !daemon) {
    throw new Error("Must provide number of threads to start and daemon.");
  }

  let i,
    child,
    that = this;

  const onMessage = (data) => {
    // see constants file for all the defined events.
    that.emit(MASTER_EVENTS.SUBPROCESS_MESSAGE, data);
  };

  const onError = (err) => {
    that.emit(MASTER_EVENTS.SUBPROCESS_ERROR, err);
    that.__clean();
  };

  const onDisconnect = () => {
    that.emit(MASTER_EVENTS.SUBPROCESS_DISCONNECT);
    that.__clean();
  };

  let startedPids = [];

  for (i = 0; i < numOfThreads; i++) {
    child = fork(daemon);
    child.on("message", onMessage);
    child.on("error", onError);
    child.on("disconnect", onDisconnect);

    child.send(metadata);

    that.__threads[child.pid] = child;
    startedPids.push(child.pid);
  }

  return startedPids;
};

Master.prototype.stop = function (pid) {
  if (!pid) {
    return;
  }

  if (this.__threads[pid]) {
    let child = this.__threads[pid];
    child.disconnect();
  }
};

Master.prototype.kill = function (pid) {
  const master = this;
  if (!pid) {
    // kill all subprocesses
    let pids = Object.keys(master.__threads);
    pids.forEach((_pid) => {
      if (master.__isRunning(_pid)) {
        process.kill(_pid);
      }
      delete master.__threads[_pid];
    });
  } else if (this.__threads.hasOwnProperty(pid)) {
    if (master.__isRunning(pid)) {
      process.kill(pid);
    }

    delete master.__threads[pid];
  }

  return;
};

Master.prototype.__isRunning = function (pid) {
  return process.kill(pid, 0);
};

Master.prototype.__clean = function () {
  const master = this;
  const pids = Object.keys(master.__threads);

  pids.forEach((pid) => {
    let child = master.__threads[pid];
    if (!child.connected && !child.killed) {
      child.disconnect();
    }

    delete master.__threads[pid];
  });
};

module.exports = {
  Master,
  MASTER_EVENTS,
};
