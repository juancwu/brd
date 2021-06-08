const { Downloader, DOWNLOADER_EVENTS } = require("../src/Downloader");
const path = require("path");

const url = "https://unsplash.com/photos/QyPqO9JmpJE/download?force=true";
const destination = path.join(__dirname, "./downloads");

const downloader = new Downloader({
  url: url,
  destination: destination,
  bandwidthThrottle: 100,
});

downloader.on(DOWNLOADER_EVENTS.PROGRESS, (stats) => {
  // process.stdout.write(
  //   `Progress: ${stats.progress} - Downloaded: ${stats.downloaded} - Total: ${stats.total}\r`
  // );
  console.log(
    `Progress: ${stats.progress} - Downloaded: ${stats.downloaded} - Total: ${stats.total}`
  );
});

downloader.on(DOWNLOADER_EVENTS.IDLE, (uuid) =>
  console.log("IDLE EVENT: " + uuid)
);

downloader.on(DOWNLOADER_EVENTS.START, (uuid) => {
  console.log("START EVENT: " + uuid);
});

downloader.on(DOWNLOADER_EVENTS.DOWNLOAD, (uuid) => {
  console.log("DOWNLOAD EVENT: " + uuid);
});

downloader.on(DOWNLOADER_EVENTS.COMPLETE, (uuid) => {
  console.log("COMPLETE EVENT: " + uuid);
});

downloader.on(DOWNLOADER_EVENTS.BEFORE_SAVE, (uuid, filename) => {
  console.log("BEFORE_SAVE EVENT: " + uuid + " " + filename);
});

downloader.on(DOWNLOADER_EVENTS.CANCEL, (uuid) => {
  console.log("CANCEL EVENT: " + uuid);
});

downloader.on(DOWNLOADER_EVENTS.ERROR, (err, uuid) => {
  console.log("ERROR EVENT: " + uuid);
  console.log(err);
});

downloader.on(DOWNLOADER_EVENTS.FILE_REMOVED, (uuid) => {
  console.log("FILE REMOVED: " + uuid);
});

downloader
  .start()
  .then(() => {
    console.log("download completed.");
  })
  .catch((e) => console.log("catch triggered"));

setTimeout(() => {
  downloader
    .cancel()
    .then(() => console.log("download cancelled."))
    .catch((e) => console.log("catch triggered"));
}, 5000);
