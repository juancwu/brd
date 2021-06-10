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

module.exports = R;
