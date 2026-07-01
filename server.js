// MONGO set up
require("dotenv").config();
const port = process.env.PORT || 5000;
const db = process.env.MONGO_URI;
const secret = process.env.SESSION_SECRET;

// storing sessions in a file
var session = require("express-session");
const FileStore = require("session-file-store")(session);

// bcrypt
const bcrypt = require("bcrypt");
const SALT_ROUNDS = 10; // How strong the hashing should be

const express = require("express");
const cors = require("cors");
const app = express();
const mongoose = require("mongoose");

app.use(express.json({ limit: "50mb" }));
app.use(express.static("src"));
app.use(express.static("."));
app.use(cors());
app.use(express.urlencoded({ extended: true }));

// schema for users
const userSchema = new mongoose.Schema({
  name: String,
  email: String,
  // password: String,
  badgeInfo: {
    bg: String, // comes from front-end
    color: String,
    border: String,
  },
  trips: [String], // trip ids
});

// schema for trip
const tripSchema = new mongoose.Schema({
  destination: String,
  date: Date,
  people: [String], // user ids of people in the trip
  expenses: [
    {
      title: String,
      amount: Number,
      paidBy: [{ person: String, amount: Number }], // user ids for co-payers and the amount they paid
      owedBy: [{ person: String, amount: Number }], // people splitting the cost with their share
    },
  ],
  debts: [
    {
      person: String, // user id of who owes
      owedTo: String, // user id of who is owed
      amount: Number,
    },
  ],
  payments: [
    {
      payer: String, // user id of person paying back
      payee: String, // user id of person being paid back
      amount: Number,
      forCost: String, // expense _id
    },
  ],
});
const userModel = mongoose.model("users", userSchema);
const tripModel = mongoose.model("trips", tripSchema);

// setting up session
app.use(
  session({
    store: new FileStore({
      path: "./sessions",
      secret: secret,
      retries: 1,
    }),
    secret: secret,
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 60 * 60 * 1000 }, // 1 hour
  }),
);

main().catch((err) => console.log(err));

async function main() {
  mongoose
    .connect(db)
    .then(async () => {
      console.log("Connected to MongoDB!");
      app.listen(port, () => console.log("Server running!"));

      // update badge colors — delete after running once
      // await userModel.updateOne({ name: "Soroush" }, { $set: { badgeInfo: { bg: "#fef9c3", color: "#a16207", border: "#a16207" } } });
      // await userModel.updateOne({ name: "Shohreh" }, { $set: { badgeInfo: { bg: "#cffafe", color: "#0e7490", border: "#0e7490" } } });
      // console.log("Badge colors updated");
    })
    .catch((err) => {
      console.error("MongoDB connection failed:", err);
    });
}

//getting people information related to each specific trip with id
app.get("/people/:id", async (req, res) => {
  try {
    const data = await tripModel.findById(req.params.id);

    //should use promise all to fetch all the results and then send them to server
    const result = await Promise.all(
      data.people.map((id) => userModel.findById(id))
    );
    res.json(result);
  } catch (error) {
    res.status(500).send("Server Error!");
  }
});
