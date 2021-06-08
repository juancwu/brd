// Manages all downloads

const { EventEmitter } = require("events");
const { v4: uuidv4 } = require("uuid");

function Bookmark() {
  this.__bookmarks = {};
}

Bookmark.prototype = Object.create(EventEmitter.prototype);
Bookmark.prototype.constructor = Bookmark;

Bookmark.prototype.add = function (task, uuid) {
  if (!uuid) uuid = uuidv4();

  this.__bookmarks[uuid] = task;
  this.emit("added", uuid, task);
};

Bookmark.prototype.remove = function (uuid) {
  if (this.__bookmarks.hasOwnProperty(uuid)) {
    delete this.__bookmarks[uuid];
    this.emit("removed", uuid);
  }
  return;
};

Bookmark.prototype.get = function (uuid) {
  if (this.__bookmarks.hasOwnProperty(uuid)) {
    return this.__bookmarks[uuid];
  }

  return false;
};

Bookmark.prototype.getAll = function () {
  return {
    bookmarks: Object.keys(this.__bookmarks),
  };
};

module.exports = Bookmark;
