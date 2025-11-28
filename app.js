require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
// const bodyParser = require("body-parser");
const cors = require("cors");
const app = express();
const cookieParser = require("cookie-parser");
const path = require("path");
const PORT = process.env.PORT || 7000;
const userRoute = require("./backend/routes/userRoute");
const itemRoute = require("./backend/routes/itemRoute");
const errorHandler = require("./backend/middlewares/errorMiddleWare");
const sendEmail = require("./backend/utils/sendEmail");

// Connect to mongodb and start server
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((error) => console.log(error));

app.use(
  cors({
    origin: ["https://inex-suzj.onrender.com"],
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    credentials: true,
  })
);

// Middlewares
app.use(express.json());
app.use(cookieParser());
app.use(express.urlencoded({ extended: false }));
// app.use(bodyParser.json());
// app.use(cors());

// Route MiddleWare
app.use("/api/users", userRoute);
app.use("/api/items", itemRoute);

// Routes
app.get("/", (req, res) => {
  res.send("Home Page");
});

app.get("/test-email", async (req, res) => {
  try {
    await sendEmail(
      "Outlook SMTP Test",
      "<h2>Hello Samuel, Outlook SMTP works! 🎉</h2>",
      "adedayotimilehin10@gmail.com",
      process.env.EMAIL_USER,
      process.env.EMAIL_USER
    );
    res.send("Email sent successfully!");
  } catch (err) {
    console.log("Email Error:", err);
    res.status(500).send(err);
  }
});

// Error Middleware
app.use(errorHandler);

// Passing the frontend
// app.use(express.static(path.join(__dirname, "./frontend/build")));
// app.get("*", function (_, res) {
//   res.sendFile(
//     path.join(__dirname, "./frontend/build/index.html"),
//     function (err) {
//       res.status(500).send(err);
//     }
//   );
// });
