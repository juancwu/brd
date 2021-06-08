import https from "https";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const url =
  "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9b/Cavendish_Banana_DS.jpg/1920px-Cavendish_Banana_DS.jpg";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const destination = path.join(__dirname, "downloads");
const filename = "image.jpg";
const filepath = path.join(destination, filename);

const filestream = fs.createWriteStream(filepath);
const request = https.get(url, (response) => {
  response.on("data", (chunk) => console.log(chunk.length));

  response.pipe(filestream);
});

request.on("error", console.log);
request.on("finish", () => console.log("finish download."));
request.end(() => console.log("request end."));
