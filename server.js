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

// =========================================================
// public - accessible before login: index page + what it needs to render,
// plus the login/signup routes themselves
// =========================================================
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/public/index.html");
});
app.get("/scripts/login.js", (req, res) => {
  res.sendFile(__dirname + "/public/scripts/login.js");
});
app.use("/images", express.static(__dirname + "/public/images"));

// login route
app.post("/login", async (req, res) => {
  try {
    const user = await userModel.findOne({ email: req.body.email });

    if (user) {
      const passwordMatched = await bcrypt.compare(
        req.body.password,
        user.password,
      );

      // check if password matches
      if (passwordMatched) {
        // set up cookies
        req.session.userId = user._id;

        // we can keep the cookie if remember me checked for 2 weeks in milliseconds
        req.session.cookie.maxAge = 14 * 24 * 3600 * 1000;
        req.session.save(() => res.sendStatus(200));

        // if password doesnt match
      } else {
        res.status(401).json({ error: "Invalid credentials." });
      }
    }
    // if user email doesnt exist in the DB
    else {
      res.status(401).json({ error: "Invalid credentials." });
    }
  } catch (error) {
    res.status(500).json({ error: "Login failed." });
  }
});

// signup route
app.post("/signup", async (req, res) => {
  try {
    // check the email to be unique
    const emailExists = await userModel.findOne({ email: req.body.email });
    if (emailExists) {
      res.status(409).json({ error: "This email already exists." });
    } else {
      const hashedPassword = await bcrypt.hash(req.body.password, SALT_ROUNDS);

      const user = await userModel.create({
        name: req.body.name,
        password: hashedPassword,
        email: req.body.email,
        badgeInfo: {},
        trips: [],
      });
      req.session.userId = user._id;
      req.session.cookie.maxAge = 14 * 24 * 3600 * 1000;
      req.session.save(() => res.sendStatus(200));
    }
  } catch (error) {
    res.status(500).json({ error: "Sign Up failed." });
  }
});

// =========================================================
// everything below requires login
// =========================================================
function isAuthenticated(req, res, next) {
  // if the session exists proceed, else get the login which is index
  if (req.session.userId) next();
  else res.redirect("/");
}
app.use(isAuthenticated);

app.use(express.static("public"));
app.use(cors());
app.use(express.urlencoded({ extended: true }));

// schema for users
const userSchema = new mongoose.Schema({
  name: String,
  email: String,
  password: String,
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
  startDate: Date,
  endDate: Date,
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

// add a trip
app.post("/addTrip", async (req, res) => {
  try {
    // create the trip and put the creator in people list
    const trip = await tripModel.create({
      destination: req.body.destination,
      startDate: req.body.startDate,
      endDate: req.body.endDate,
      people: [req.session.userId],
      expenses: [],
      payments: [],
    });

    // update the user model and add the trip to their info

    await userModel.findByIdAndUpdate(req.session.userId, {
      $push: { trips: trip._id },
    });
    res.json(trip._id);
  } catch (error) {
    res.status(500).send("Server Error!");
  }
});

// send all the user trips
app.get("/allTrips", async (req, res) => {
  try {
    const user = await userModel.findById(req.session.userId, { trips: 1 });
    // the line above will return { _id, trips: [<tripId>, <tripId>, ...] } , trip info should be gotten from trip model
    const userTrips = await Promise.all(
      user.trips.map((id) => tripModel.findById(id)),
    );
    res.json(userTrips);
  } catch (error) {
    res.status(500).send("Server Error!");
  }
});

// get single trip info
app.get("/singleTripDetails/:id", async (req, res) => {
  try {
    const trip = await tripModel.findById(req.params.id);
    res.json(trip);
  } catch (error) {
    res.status(500).send("Server Error!");
  }
});

//delete a trip
app.delete("/deleteTrip/:id", async (req, res) => {
  try {
    // remove that trip from user doc
    await userModel.findByIdAndUpdate(req.session.userId, {
      $pull: { trips: req.params.id },
    });

    // remove that person from that trip document
    const trip = await tripModel.findByIdAndUpdate(
      req.params.id,
      { $pull: { people: req.session.userId } },
      { new: true },
    );

    // delete the trip document if no person is in it
    if (trip.people.length === 0) {
      await tripModel.findByIdAndDelete(req.params.id);
    }
    res.sendStatus(200);
  } catch (error) {
    res.status(500).send("Server Error!");
  }
});

// edit a trip
app.put("/editTrip/:id", async (req, res) => {
  try {
    const trip = await tripModel.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          destination: req.body.destination,
          startDate: req.body.startDate,
          endDate: req.body.endDate,
        },
      },
      { new: true },
    );
    res.json(trip);
  } catch (error) {
    res.status(500).send("Server Error!");
  }
});

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

// update an existing expense in place
app.put("/updateExpense/:tripId/:expenseId", async (req, res) => {
  try {
    const { title, amount, paidBy, owedBy } = req.body;
    const trip = await tripModel.findById(req.params.tripId);

    // find the specific expense inside the expenses array
    const expense = trip.expenses.id(req.params.expenseId);

    // mutate it directly, like a normal JS object
    expense.title = title;
    expense.amount = amount;
    expense.paidBy = paidBy;
    expense.owedBy = owedBy;

    // persist the mutation
    await trip.save();
    res.json(expense);
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

// wipe every expense and settlement record for a trip - full reset
app.delete("/resetTrip/:tripId", async (req, res) => {
  try {
    const trip = await tripModel.findByIdAndUpdate(
      req.params.tripId,
      { $set: { expenses: [], payments: [] } },
      { new: true },
    );
    res.json(trip);
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

// route for sending all owedBy amounts and payments amounts for a specific id
app.get("/spentDetails/:tripId/:personId", async (req, res) => {
  try {
    const trip = await tripModel.findById(req.params.tripId);
    // resuly would be similar to [ {person:"a",amount:5}, {person:"b",amount:10}, {person:"a",amount:3} ]
    const expenses = trip.expenses
      .flatMap((expense) => expense.owedBy)
      .filter((item) => item.person === req.params.personId);
    const payments = trip.payments.filter(
      (item) => item.payer === req.params.personId,
    );
    const totalExp = expenses.reduce(
      (accum, element) => accum + element.amount,
      0,
    );
    const totalPay = payments.reduce(
      (accum, element) => accum + element.amount,
      0,
    );
    const response = {
      id: req.params.personId,
      expenses: totalExp,
      payments: totalPay,
    };
    res.json(response);
  } catch (error) {
    res.status(500).send("Server Error!");
  }
});

// send over the user info for account page
app.get("/userInfo", async (req, res) => {
  try {
    const user = await userModel.findById(req.session.userId);
    res.json({id:req.session.userId, email: user.email, name: user.name });
  } catch (error) {
    res.status(500).send("could not get user Data.");
  }
});

// update user account
app.put("/editUserInfo", async (req, res) => {
  try {
    await userModel.findByIdAndUpdate(req.session.userId, {
      $set: { name: req.body.name, email: req.body.email },
    });
    res.sendStatus(200);
  } catch (error) {
    res.status(500).send("Could not update the profile.");
  }
});

// update password
app.put("/changePassword", async (req, res) => {
  try {
    const user = await userModel.findById(req.session.userId);
    const passwordMatched = await bcrypt.compare(
      req.body.currentPassword,
      user.password,
    );

    if (passwordMatched) {
      const newPass = await bcrypt.hash(req.body.newPassword, SALT_ROUNDS);
      user.password = newPass;
      await user.save();
      res.sendStatus(200);
    } else {
      res.status(401).json({ error: "your current password is incorrect." });
    }
  } catch (error) {
    res.status(500).json({ error: "Could not change password." });
  }
});

// logout route
app.post("/logout", (req, res) => {
  try {
    req.session.destroy(() => res.sendStatus(200));
  } catch (error) {
    res.status(500).send("Could not log out.");
  }
});

// delete account route
app.delete("/deleteAccount", async (req, res) => {
  try {
    const user = await userModel.findByIdAndDelete(req.session.userId);

    // remove this user from every trip they were part of, deleting any
    // trip that becomes empty as a result (same as the deleteTrip route)
    await Promise.all(
      user.trips.map(async (tripId) => {
        const trip = await tripModel.findByIdAndUpdate(
          tripId,
          { $pull: { people: req.session.userId } },
          { new: true },
        );
        if (trip.people.length === 0) {
          await tripModel.findByIdAndDelete(tripId);
        }
      }),
    );

    req.session.destroy(() => res.sendStatus(200));
  } catch (error) {
    res.status(500).send("Could not delete account.");
  }
});
