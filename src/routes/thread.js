const R = require("express").Router();

R.get("/kill/:pid", async (req, res, next) => {
  let pid = req.params.pid;

  if (!pid) return next(new Error("No pid provided."));

  req.app.get("master").kill(pid);

  res.send({ pid, status: "Killing..." });
});

R.get("/stop/:pid", async (req, res, next) => {
  let pid = req.params.pid;

  if (!pid) return next(new Error("No pid provided."));

  req.app.get("master").stop(pid);

  res.send({ pid, status: "Stopping..." });
});

R.get("/all", async (req, res, next) => {
  let allThreads = req.app.get("master").get();

  res.send({
    allThreads,
  });
});

R.get("/get", async (req, res, next) => {
  if (!req.query.pid) return next(new Error("No pid provided"));

  let thread = req.app.get("master").get(req.query.pid);

  res.send({
    thread,
  });
});

module.exports = R;
