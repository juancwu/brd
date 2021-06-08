const { Downloader, DOWNLOADER_EVENTS } = require("../src/Downloader");
const path = require("path");

const url = "https://unsplash.com/photos/QyPqO9JmpJE/download?force=true";
const destination = path.join(__dirname, "./downloads");

const downloader = new Downloader({
  url: url,
  destination: destination,
  progressThrottle: 500,
});

downloader
  .start()
  .then(() => {
    console.log("download completed.");
  })
  .catch(console.log);

downloader.on(DOWNLOADER_EVENTS.PROGRESS, (stats) => {
  // process.stdout.write(
  //   `Progress: ${stats.progress} - Downloaded: ${stats.downloaded} - Total: ${stats.total}\r`
  // );
  console.log(
    `Progress: ${stats.progress} - Downloaded: ${stats.downloaded} - Total: ${stats.total}`
  );
});
