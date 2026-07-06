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
  payments: [
    {
      payer: String, // user id of person paying back
      payee: String, // user id of person being paid back
      amount: Number,
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
      data.people.map((id) => userModel.findById(id)),
    );
    res.json(result);
  } catch (error) {
    res.status(500).send("Server Error!");
  }
});

//add new expense
app.post("/newExpense/:id", async (req, res) => {
  try {
    const { title, amount, paidBy, owedBy } = req.body;

    const trip = await tripModel.findByIdAndUpdate(
      req.params.id,
      {
        $push: {
          expenses: { title, amount, paidBy, owedBy },
        },
      },
      { new: true }, // return the updated document instead of the pre-update one
    );

    // send just the new expense with its real _id
    res.json(trip.expenses.at(-1));
  } catch (error) {
    res.status(500).send("Server Error!");
  }
});

//get all the expenses for a trip
app.get("/getExpenses/:id", async (req, res) => {
  try {
    const trip = await tripModel.findById(req.params.id);

    const tripExpenses = trip.expenses;

    res.json(tripExpenses);
  } catch (error) {
    res.status(500).send("Server Error!");
  }
});

// delete a certain expense from the db
app.delete("/deleteExpense/:tripId/:expenseId", async (req, res) => {
  try {
    const expense = await tripModel.findByIdAndUpdate(
      req.params.tripId,
      { $pull: { expenses: { _id: req.params.expenseId } } },
      { new: true },
    );
    res.json(expense);
  } catch (error) {
    res.status(500).send("Server Error!");
  }
});

// update the owedBy array based on the payments that are made
app.put("/markSettled/:tripId", async (req, res) => {
  try {
    const body = req.body;
    const trip = await tripModel.findById(req.params.tripId);

    body.forEach((entry) => {
      // step 1: find the specific expense inside the expenses array
      const expense = trip.expenses.id(entry.expenseId);

      // step 2: find the specific owedBy entry inside that expense
      const owedByEntry = expense.owedBy.find(
        (item) => item.person === entry.debtor,
      );

      if (entry.amount) {
        // step 3: just... subtract, like a normal JS object
        owedByEntry.amount -= entry.amount;
      } else {
        // step 3: remove that person and amount from the owedBy array
        expense.owedBy.pull({ person: entry.debtor });
      }
    });

    // step 4: persist every mutation above in a single write
    await trip.save();
    res.json(trip);
  } catch (error) {
    res.status(500).send("Server Error!");
  }
});

// record the payments made in the db
app.post("/payment/:tripId", async (req, res) => {
  try {
    const body = req.body;
    const trip = await tripModel.findByIdAndUpdate(
      req.params.tripId,
      {
        $push: {
          payments: { payer: body.from, payee: body.to, amount: body.amount },
        },
      },
      { new: true },
    );
    res.json(trip);
  } catch (error) {
    res.status(500).send("Server Error!");
  }
});
