const { Downloader, DOWNLOADER_EVENTS } = require("../src/Downloader");
const path = require("path");

const url = "https://unsplash.com/photos/QyPqO9JmpJE/download?force=true";
const destination = path.join(__dirname, "./downloads");

const downloader = new Downloader({
  url: url,
  destination: destination,
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

downloader
  .start()
  .then(() => {
    console.log("download completed.");
  })
  .catch(console.log);
