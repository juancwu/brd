const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");
const mime = require("mime-types");
const { EventEmitter } = require("events");
const util = require("util");
const Limiter = require("./Limiter");
const { v4: uuidv4 } = require("uuid");

const DOWNLOADER_EVENTS = {
  IDLE: "idle",
  START: "start",
  DOWNLOAD: "download",
  COMPLETE: "complete",
  SAVED: "saved",
  PROGRESS: "progress",
  ERROR: "error",
  RESUMED: "resumed",
  BEFORE_SAVE: "before_save",
  PAUSED: "paused",
  FILE_REMOVED: "file_removed",
  RETRY: "retry",
};

const DOWNLOADER_STATES = {
  IDLE: 0,
  DOWNLOAD: 1,
  COMPLETE: 2,
  ERROR: 3,
  PAUSED: 4,
  CANCELLED: 5,
};

/**
 *
 * @param {object} options
 * @param {string} options.url
 * @param {string} options.destination
 * @param {string} [options.uuid]
 * @param {string} [options.filename]
 * @param {string} [options.method = 'GET']
 * @param {boolean} [options.retry = false]
 * @param {boolean} [options.resumable = false]
 * @param {number} [options.bandwidthThrottle = 0] - 0 means no throttle. throttle > 100kb/s
 * @param {number} [options.progressThrottle = 500] - 0.5s for progress update
 * @param {number} [options.maxRetries = 3]
 * @param {boolean} [options.cloneFiles = true]
 * @param {boolean} [options.removeOnError = true]
 * @param {function} [options.onProgress]
 * @param {function} [options.onError]
 * @param {function} [options.onPaused]
 * @param {function} [options.onResumed]
 * @param {function} [options.onCompleted]
 * @param {function} [options.onBeforeSave]
 */
function Downloader(options) {
  this.__options = Object.assign(
    {
      // todo: implement random string generator.
      uuid: this.__generateUID(),
      filename: "",
      method: "GET",
      retry: true,
      resumable: false,
      bandwidthThrottle: 0,
      progressThrottle: 500,
      maxRetries: 3,
      cloneFiles: true,
      removeOnError: true,
      onProgress: null,
      onError: null,
      onPaused: null,
      onResumed: null,
      onCompleted: null,
      onBeforeSave: null,
    },
    options
  );

  this.__statsEstimate = {
    recordedTime: 0,
    bytes: 0,
    prevBytes: 0,
  };

  this.__fileStats = {
    filename: "",
    extension: "",
    noExtFile: "",
    filepath: "",
    filesize: 0,
    filestream: null,
    tmpFilename: "",
    tmpFilepath: "",
  };

  this.__downloadStats = {
    total: 0,
    downloaded: 0,
    progress: 0,
  };

  this.__net = {
    protocol: null,
    request: null,
    response: null,
    socket: null,
  };

  this.__events = DOWNLOADER_EVENTS;
  this.__states = DOWNLOADER_STATES;

  this.__isResumed = false;
  this.__isPaused = false;
  this.__isDownloading = false;
  this.__isCancelled = false;

  this.__limiter = null;

  this.__setState(this.__states.IDLE);
  this.__emit(this.__events.IDLE, this.__options.uuid);
}

util.inherits(Downloader, EventEmitter);

/**
 *
 * @returns {Promise<void>}
 */
Downloader.prototype.start = function () {
  const that = this;
  return new Promise((resolve, reject) => {
    that.__emit(that.__events.START, that.__options.uuid);
    that.__initProcotol();
    that.__net.request = that.__requestDownload(resolve, reject);

    that.__net.request.on("error", (e) => {
      return that.__onError(e, resolve, reject);
    });
    that.__net.request.on("timeout", () => console.log("timeout"));

    that.__net.request.end(() => console.log("request end."));
  });
};

Downloader.prototype.__initProcotol = function () {
  this.__net.protocol = /^https:\/\//.test(this.__options.url) ? https : http;
  return;
};

/**
 *
 * @param {Promise.resolve} resolve
 * @param {Promise.reject} reject
 * @returns {http.ClientRequest}
 */
Downloader.prototype.__requestDownload = function (resolve, reject) {
  const that = this;
  return this.__net.protocol.request(
    this.__options.url,
    /**
     *
     * @param {http.IncomingMessage} response
     * @returns
     */
    (response) => {
      if (that.__isRedirect(response)) {
        that.__options.url = response.headers["location"];
        return that
          .start()
          .then(() => resolve(true))
          .catch((err) => that.__onError(err, resolve, reject));
      } else if (response.statusCode >= 200 && response.statusCode < 300) {
        that.__net.response = response;
        that.__startDownload(response, resolve, reject);
      } else {
        // failed
        let err = new Error(`Response status was: ${response.statusCode}`);
        return that.__onError(err, resolve, reject);
      }
    }
  );
};

/**
 *
 * @param {http.IncomingMessage} response
 * @param {Promise.resolve} resolve
 * @param {Promise.reject} reject
 */
Downloader.prototype.__startDownload = function (response, resolve, reject) {
  const that = this;

  this.__getFileStats(response);

  this.__emit(this.__events.DOWNLOAD, this.__options.uuid);

  this.__statsEstimate.recordedTime = new Date();

  response.on("data", (chunk) => that.__onProgress(chunk.length));

  response.unpipe();

  if (this.__options.bandwidthThrottle > 0) {
    this.__limiter = new Limiter(this.__options.bandwidthThrottle);
    response.pipe(this.__limiter).pipe(this.__fileStats.filestream);

    this.__limiter.on("pause", () => response.pause());

    this.__limiter.on("resume", () => response.resume());

    this.__limiter.on("end", () => {
      console.log("limiter end event");
      that.__onCompleted();
    });

    this.__limiter.on("error", (err) => that.__onError(err, resolve, reject));
  } else {
    response.pipe(this.__fileStats.filestream);
    response.on("end", () => {
      console.log("response end event");
      that.__onCompleted();
    });
  }

  response.on("error", (err) => that.__onError(err, resolve, reject));

  this.__fileStats.filestream.on("error", (err) => {
    that.__onError(err, resolve, reject);
  });

  this.__fileStats.filestream.on("finish", () => {
    resolve(true);
  });
};

/**
 *
 * @param {number} receivedBytes
 * @returns
 */
Downloader.prototype.__getNewStatsEstimate = function (receivedBytes) {
  if (!receivedBytes) return;

  const currentTime = new Date();
  const elapsedTime = currentTime - this.__statsEstimate.recordedTime;

  this.__downloadStats.downloaded += receivedBytes;
  this.__downloadStats.progress = (
    (this.__downloadStats.downloaded / this.__downloadStats.total) *
    100
  ).toFixed(2);

  if (
    this.__downloadStats.downloaded === this.__downloadStats.total ||
    elapsedTime > this.__options.progressThrottle
  ) {
    this.__statsEstimate.recordedTime = currentTime;
    this.__statsEstimate.bytes =
      this.__downloadStats.downloaded - this.__statsEstimate.prevBytes;
    this.__statsEstimate.prevBytes = this.__downloadStats.downloaded;
  }
};

Downloader.prototype.__getStats = function () {
  return {
    total: this.__downloadStats.total,
    progress: this.__downloadStats.progress,
    downloaded: this.__downloadStats.downloaded,
    filename: this.__fileStats.filename,
  };
};

/**
 *
 * @param {http.IncomingMessage} response
 * @returns
 */
Downloader.prototype.__getFileStats = function (response) {
  // set filename, filepath and filesize
  this.__fileStats.filesize = this.__downloadStats.total =
    response.headers["content-length"] || 0;

  this.__fileStats.filename = this.__getFilename(response.headers);
  this.__fileStats.filepath = this.__getFilepath(this.__fileStats.filename);
  let separated = this.__separateFilenameAndExtension(
    this.__fileStats.filename
  );

  this.__fileStats.extension = separated[0];
  this.__fileStats.noExtFile = separated[1];

  this.__checkForClonedFiles(); // reset filename if cloneFile is true and there are clones.
  this.__fileStats.filepath = this.__getFilepath(this.__fileStats.filename);

  this.__fileStats.tmpFilename = this.__fileStats.filename + ".download";
  this.__fileStats.tmpFilepath = path.join(
    this.__options.destination,
    this.__fileStats.tmpFilename
  );
  this.__fileStats.filestream = fs.createWriteStream(
    this.__fileStats.tmpFilepath
  );
  return;
};

Downloader.prototype.__createNewFilename = function (filename, counter = 1) {
  if (!fs.existsSync(path.join(this.__options.destination, filename)))
    return filename;

  counter += 1;
  let newFilename = `${this.__fileStats.noExtFile}_${counter}.${this.__fileStats.extension}`;
  return this.__createNewFilename(newFilename, counter);
};

Downloader.prototype.__checkForClonedFiles = function () {
  if (this.__options.cloneFiles && fs.existsSync(this.__fileStats.filepath)) {
    this.__fileStats.filename = this.__createNewFilename(
      this.__fileStats.filename
    );
  }
  return;
};

/**
 *
 * @param {string} filename
 */
Downloader.prototype.__getFilepath = function (filename) {
  if (!filename)
    filename = this.__options.filename.length
      ? this.__options.filename
      : this.__getFilename();

  return path.join(this.__options.destination, filename);
};

/**
 *
 * @param {http.IncomingHttpHeaders} headers
 * @returns {string}
 */
Downloader.prototype.__getFilename = function (headers) {
  if (typeof headers === "undefined")
    return `brd_${this.__options.uuid}.download`;

  let filename = "";

  if (this.__options.filename) {
    filename = this.__options.filename;
  } else if (
    headers.hasOwnProperty("content-disposition") &&
    headers["content-disposition"].indexOf("filename=") > -1
  ) {
    filename = headers["content-disposition"];
    filename = filename.trim();
    filename = filename.substr(filename.indexOf("filename=") + 9);
    filename = filename.replace(/"/g, "");
    filename = filename.replace(/[\/\\]/g, "");
  } else {
    filename = `_${this.__options.uuid}.brd`;
  }

  return filename;
};

/**
 *
 * @param {string} filename
 * @returns {string}
 */
Downloader.prototype.__getExtenstion = function (filename) {
  // check for Downloader extension, when filename was not found.
  if (filename.substr(filename.lastIndexOf(".") + 1) === "brd") return "brd";
  let contentType = mime.lookup(filename);
  if (!contentType) {
    return "brd";
  }

  return mime.extension(contentType);
};

/**
 *
 * @param {string} filename
 * @param {Array<string>}
 */
Downloader.prototype.__separateFilenameAndExtension = function (filename) {
  let extension = this.__getExtenstion(filename);
  let noExtensionFilename = filename.replace(extension, "");

  if (noExtensionFilename === filename) {
    noExtensionFilename = filename.substr(0, filename.lastIndexOf("."));
    extension = filename.substr(filename.lastIndexOf(".") + 1);
  }

  return [extension, noExtensionFilename];
};

/**
 *
 * @param {http.IncomingMessage} response
 * @returns
 */
Downloader.prototype.__isRedirect = function (response) {
  return (
    response.statusCode > 300 &&
    response.statusCode < 400 &&
    response.headers["location"]
  );
};

/**
 *
 * @returns {Promise<boolean>}
 */
Downloader.prototype.__removeFile = function () {
  return new Promise((resolve, reject) => {
    fs.access(this.__fileStats.tmpFilepath, (_err) => {
      if (_err) {
        return resolve(true); // file does not exists.
      }

      fs.unlink(this.__fileStats.tmpFilepath, (_err) => {
        if (_err) {
          return reject(_err);
        }

        resolve(true);
      });
    });
  });
};

Downloader.prototype.__generateUID = function () {
  return uuidv4();
};

Downloader.prototype.__setState = function (state) {
  this.__state = state;
};

Downloader.prototype.__emit = function (eventName, ...data) {
  if (!eventName) {
    throw new Error("Cannot emit to undefined event.");
  }

  this.emit(eventName, ...data);
};

Downloader.prototype.__onBeforeSave = function () {
  let saveName = null;
  if (typeof this.__options.onBeforeSave === "function") {
    saveName = this.__options.onBeforeSave(this.__fileStats.filename);
  } else {
    this.__emit(
      this.__events.BEFORE_SAVE,
      this.__options.uuid,
      this.__fileStats.filename
    );
  }

  // if the custom onBeforeSave function returns undefined then just use the original save filename.
  saveName =
    typeof saveName === "string" ? saveName : this.__fileStats.filename;

  // rename the tmpFilname to the saveName
  fs.renameSync(
    this.__fileStats.tmpFilepath,
    path.join(this.__options.destination, saveName)
  );
};

Downloader.prototype.__onCompleted = function () {
  // const that = this;
  this.__fileStats.filestream.end();
  if (typeof this.__options.onCompleted === "function") {
    this.__options.onCompleted(this.__options.uuid);
  } else {
    this.__emit(this.__events.COMPLETE, this.__options.uuid);
  }
  this.__onBeforeSave();
};

Downloader.prototype.__onProgress = function (receivedBytes) {
  // const that = this;

  if (typeof this.__options.onProgress === "function") {
    this.__options.onProgress(receivedBytes);
  } else {
    this.__getNewStatsEstimate(receivedBytes);
    this.__emit(this.__events.PROGRESS, this.__getStats());
  }
};

Downloader.prototype.__onError = function (err, _, reject) {
  const that = this;
  if (typeof this.__options.onError === "function") {
    this.__options.onError(err, this.__options.removeOnError, {
      filename: this.__fileStats.filename,
      filepath: this.__fileStats.filepath,
      tmpFilename: this.__fileStats.tmpFilename,
      tmpFilepath: this.__fileStats.tmpFilepath,
      extension: this.__fileStats.extension,
      noExtensionFilename: this.__fileStats.noExtFile,
    });
    return reject();
  } else {
    this.emit(that.__events.ERROR, err);
    if (this.__options.removeOnError) {
      this.__removeFile()
        .then(() => {
          that.emit(that.__events.FILE_REMOVED);
          reject(err);
        })
        .catch((_err) => reject(_err));
    } else {
      reject(err);
    }
  }
};

module.exports = {
  Downloader,
  DOWNLOADER_EVENTS,
  DOWNLOADER_STATES,
};
