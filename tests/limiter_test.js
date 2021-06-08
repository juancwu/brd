const { Stream } = require("stream");

function Limiter(limit) {
  this.readable = true;
  this.writable = true;

  this.limit = null;
  this.sentBytes = this.tmpSentBytes = 0;
  this.startTime = this.tmpStartTime = new Date();

  if (limit) this.setLimit(limit);
}

Limiter.prototype = Object.create(Stream.prototype);
Limiter.prototype.constructor = Limiter;

/**
 *
 * @param {number} limit - kb
 */
Limiter.prototype.setLimit = function (limit) {
  this.limit = (limit * 1024) / 1000.0; // kb/s
  this.tmpSentBytes = 0;
  this.tmpStartTime = new Date();
};

Limiter.prototype.write = function (data) {
  const that = this;

  this.sentBytes += data.length;
  this.tmpSentBytes += data.length;

  // console.log("emit data");
  this.emit("data", data);

  if (this.limit) {
    let elapsedTime = new Date() - this.tmpStartTime;
    let assumedTime = this.tmpSentBytes / this.limit;
    let lag = assumedTime - elapsedTime;

    if (lag > 0) {
      // console.log("emit pause, will resume in: " + lag + "ms");
      this.emit("pause");
      setTimeout(() => {
        // console.log("emit resume");
        that.emit("resume");
      }, lag);
    }
  }
};

Limiter.prototype.end = function () {
  // console.log("emit end");
  this.emit("end");
};

Limiter.prototype.error = function (err) {
  // console.log("emit error: " + err);
  this.emit("error", err);
};

Limiter.prototype.close = function () {
  // console.log("emit close");
  this.emit("close");
};

Limiter.prototype.destroy = function () {
  // console.log("emit destroy");
  this.emit("destroy");
};

module.exports = Limiter;
