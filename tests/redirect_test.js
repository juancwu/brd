const https = require("https");
const fs = require("fs");
const path = require("path");
const Limiter = require("./limiter_test");

const destination = path.join(__dirname, "downloads");
const filename = "image2.jpg";
const filepath = path.join(destination, filename);
const url = "https://unsplash.com/photos/rydTSO7xB5A/download?force=true";

const stats = {
  time: 0,
  throttle: 1000,
  bytes: 0,
  prevBytes: 0,
  total: 0,
  downloaded: 0,
  progress: 0,
};

function getStats(receivedBytes) {
  if (!receivedBytes) return;

  const currentTime = new Date();
  const elapsedTime = currentTime - stats.time;

  stats.downloaded += receivedBytes;
  stats.progress = ((stats.downloaded / stats.total) * 100).toFixed(2);

  if (stats.downloaded === stats.total || elapsedTime > stats.throttle) {
    stats.time = currentTime;
    stats.bytes = stats.downloaded - stats.prevBytes;
    stats.prevBytes = stats.downloaded;
  }
}

function download(url, destination) {
  const request = https.request(url, (response) => {
    if (
      response.statusCode > 300 &&
      response.statusCode < 400 &&
      response.headers.hasOwnProperty("location") &&
      response.headers["location"]
    ) {
      // redirect
      return download(response.headers["location"], destination);
    }

    if (response.statusCode >= 200 && response.statusCode < 300) {
      stats.total = response.headers["content-length"] || 0;
      const filestream = fs.createWriteStream(filepath);
      response.on("data", (chunk) => {
        getStats(chunk.length);
        console.log(
          `speed: ${stats.bytes} - progress: ${stats.progress} - total: ${stats.total}`
        );
      });

      const limiter = new Limiter(150);

      response.pipe(limiter).pipe(filestream);

      limiter.on("pause", () => {
        response.pause();
      });

      limiter.on("resume", () => {
        response.resume();
      });

      limiter.on("end", () => {
        filestream.end();
      });
    } else {
      console.log(`Response status code: ${response.statusCode}`);
    }
  });

  request.on("error", console.log);
  request.end(() => console.log("request end."));
}

download(url, destination);
