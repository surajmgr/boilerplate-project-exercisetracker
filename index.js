const express = require("express");
const app = express();
const cors = require("cors");
const mongoose = require("mongoose");
var bodyParser = require("body-parser");
require("dotenv").config();

const uri = process.env.MONGO_URI;
mongoose.connect(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const connection = mongoose.connection;
connection.on("error", console.error.bind(console, "connection error: "));
connection.once("open", () => {
  console.log("Database Connected Successfully!");
});
app.use(cors());

/** this project needs to parse POST bodies **/
// you should mount the body-parser here

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.use("/public", express.static(process.cwd() + "/public"));
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/views/index.html");
});
var Schema = mongoose.Schema;

var exerciseUsersSchema = new Schema({
  username: { type: String, unique: true, required: true },
});

var ExerciseUsers = mongoose.model("ExerciseUsers", exerciseUsersSchema);

var exercisesSchema = new Schema({
  userId: { type: String, required: true },
  description: { type: String, required: true },
  duration: { type: Number, min: 1, required: true },
  date: { type: Date, default: Date.now },
});

var Exercises = mongoose.model("Exercises", exercisesSchema);

app.post("/api/users", async function (req, res) {
  if (req.body.username === "") {
    return res.json({ error: "username is required" });
  }

  let username = req.body.username;
  let _id = "";

  let findOne = await ExerciseUsers.findOne({ username: username });
  if (!findOne) {
    let newUser = new ExerciseUsers({
      username: username,
    });

    newUser.save(function (err, data) {
      if (!err) {
        _id = data["_id"];

        return res.json({
          _id: _id,
          username: username,
        });
      }
    });
  } else {
    return res.json({ error: "username already exists" });
  }
});

app.get("/api/users", async function (req, res) {
  let find = await ExerciseUsers.find({});

  return res.json(find);
});

app.post("/api/users/:_id/exercises", async function (req, res) {
  if (req.params._id === "0") {
    return res.json({ error: "_id is required" });
  }

  if (req.body.description === "") {
    return res.json({ error: "description is required" });
  }

  if (req.body.duration === "") {
    return res.json({ error: "duration is required" });
  }

  let userId = req.params._id;
  let description = req.body.description;
  let duration = parseInt(req.body.duration);
  console.log(req.body.date);
  let date = req.body.date ? new Date(req.body.date) : Date.now();

  console.log(date);

  if (isNaN(duration)) {
    return res.json({ error: "duration is not a number" });
  }

  if (date == "Invalid Date") {
    return res.json({ error: "date is invalid" });
  }

  let find = await ExerciseUsers.findOne({ _id: userId });
  console.log(find);

  if (find) {
    let newExercise = new Exercises({
      userId: userId,
      description: description,
      duration: duration,
      date: date,
    });

    newExercise.save(function (err2, data2) {
      if (!err2) {
        return res.json({
          _id: find["_id"],
          username: find["username"],
          description: data2["description"],
          duration: data2["duration"],
          date: new Date(data2["date"]).toDateString(),
        });
      }
    });
  } else {
    return res.json({ error: "user not found" });
  }
});

app.get("/api/users/:_id/exercises", function (req, res) {
  res.redirect("/api/users/" + req.params._id + "/logs");
});

app.get("/api/users/:_id/logs", async function (req, res) {
  let userId = req.params._id;
  let findConditions = { userId: userId };

  if (
    (req.query.from !== undefined && req.query.from !== "") ||
    (req.query.to !== undefined && req.query.to !== "")
  ) {
    findConditions.date = {};

    if (req.query.from !== undefined && req.query.from !== "") {
      findConditions.date.$gte = new Date(req.query.from);
    }

    if (findConditions.date.$gte == "Invalid Date") {
      return res.json({ error: "from date is invalid" });
    }

    if (req.query.to !== undefined && req.query.to !== "") {
      findConditions.date.$lte = new Date(req.query.to);
    }

    if (findConditions.date.$lte == "Invalid Date") {
      return res.json({ error: "to date is invalid" });
    }
  }

  let limit = req.query.limit !== undefined ? parseInt(req.query.limit) : 0;

  if (isNaN(limit)) {
    return res.json({ error: "limit is not a number" });
  }

  let find = await ExerciseUsers.findById(userId);
  if (find) {
    Exercises.find(findConditions)
      .sort({ date: "asc" })
      .limit(limit)
      .exec(function (err2, data2) {
        if (!err2) {
          return res.json({
            _id: find["_id"],
            username: find["username"],
            log: data2.map(function (e) {
              return {
                description: e.description,
                duration: e.duration,
                date: new Date(e.date).toDateString(),
              };
            }),
            count: data2.length,
          });
        }
      });
  } else {
    return res.json({ error: "user not found" });
  }
});

// Not found middleware
app.use((req, res, next) => {
  return next({ status: 404, message: "not found" });
});

// Error handling middleware
app.use((err, req, res, next) => {
  let errCode, errMessage;

  if (err.errors) {
    // mongoose validation error
    errCode = 400; // bad request
    const keys = Object.keys(err.errors);
    // report the first validation error
    errMessage = err.errors[keys[0]].message;
  } else {
    // generic or custom error
    errCode = err.status || 500;
    errMessage = err.message || "Internal Server Error";
  }

  res.status(errCode).type("txt").send(errMessage);
});

const listener = app.listen(process.env.PORT || 3000, () => {
  console.log("Your app is listening on port " + listener.address().port);
});
