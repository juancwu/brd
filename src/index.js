const express = require("express");
const Bookmark = require("./Bookmark");
const { MASTER_EVENTS, Master } = require("./Master");

const app = express();
const bookmark = new Bookmark();
const master = new Master();

master.on(MASTER_EVENTS.SUBPROCESS_MESSAGE, (data) => {
  if (data.error) {
    console.log("Caught error");
    console.log(data.error);
    master.stop(data.pid);
    return;
  }

  if (data.message) {
    console.log(`Message from subprocess(${data.pid})`);
    console.log(data.message);
  }
});

master.on(MASTER_EVENTS.SUBPROCESS_DISCONNECT, () => {
  console.log("Subprocess disconnected.");
});

master.on(MASTER_EVENTS.SUBPROCESS_ERROR, (err) => {
  console.log("Subprocess error");
  console.log(err);
});

bookmark.on("added", (uuid, task) => {
  console.log("Task added to bookmark with uuid: " + uuid);
});

bookmark.on("removed", (uuid) => {
  console.log("Task removed from bookmark with uuid: " + uuid);
});

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.set("bookmark", bookmark);
app.set("master", master);

app.use("/download", require("./routes/download"));
app.use("/thread", require("./routes/thread"));
app.use("/bookmark", require("./routes/bookmark"));

const port = process.env.PORT || 3210;

app.listen(port, () => console.log("listening on port: ", port));
