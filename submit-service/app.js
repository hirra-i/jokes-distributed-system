const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");
const swaggerUi = require("swagger-ui-express");
const swaggerJsdoc = require("swagger-jsdoc");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname + "/public"));


// ---------------- SWAGGER SETUP ----------------

const swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Submit Joke API",
      version: "1.0.0",
      description: "API for submitting jokes and retrieving types"
    },
    servers: [
      {
        url: "http://localhost:3001"
      }
    ]
  },
  apis: ["./app.js"], // 👈 IMPORTANT FIX
};

const swaggerDocs = swaggerJsdoc(swaggerOptions);
app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerDocs));


// ---------------- DATABASE ----------------

const db = mysql.createPool({
  host: "database",
  user: "root",
  password: "root",
  database: "jokesdb",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});


// ---------------- ROUTES ----------------

/**
 * @swagger
 * /types:
 *   get:
 *     summary: Get all joke types
 *     responses:
 *       200:
 *         description: List of joke types
 */
app.get("/types", (req, res) => {
  db.query("SELECT * FROM types", (err, results) => {
    if (err) return res.status(500).json(err);
    res.json(results);
  });
});


/**
 * @swagger
 * /submit:
 *   post:
 *     summary: Submit a new joke
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               setup:
 *                 type: string
 *               punchline:
 *                 type: string
 *               type:
 *                 type: string
 *     responses:
 *       200:
 *         description: Joke submitted successfully
 */
app.post("/submit", (req, res) => {
  const { setup, punchline, type } = req.body;

  const typeQuery = "SELECT id FROM types WHERE name = ?";

  db.query(typeQuery, [type], (err, typeResult) => {
    if (err) return res.status(500).json(err);

    let typeId;

    if (typeResult.length === 0) {
      db.query("INSERT INTO types (name) VALUES (?)", [type], (err, insertType) => {
        if (err) return res.status(500).json(err);

        typeId = insertType.insertId;
        insertJoke(typeId);
      });
    } else {
      typeId = typeResult[0].id;
      insertJoke(typeId);
    }

    function insertJoke(typeId) {
      const jokeQuery = "INSERT INTO jokes (setup, punchline, type_id) VALUES (?, ?, ?)";

      db.query(jokeQuery, [setup, punchline, typeId], (err) => {
        if (err) return res.status(500).json(err);

        res.json({ message: "Joke submitted successfully" });
      });
    }
  });
});


// ---------------- WAIT FOR DB THEN START ----------------

function waitForDB() {
  db.query("SELECT 1", (err) => {
    if (err) {
      console.log("Waiting for MySQL...");
      setTimeout(waitForDB, 2000);
    } else {
      console.log("Connected to MySQL!");

      app.listen(3001, () => {
        console.log("Submit service running on port 3001");
      });
    }
  });
}

waitForDB();