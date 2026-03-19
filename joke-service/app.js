const swaggerUi = require("swagger-ui-express");
const swaggerJsdoc = require("swagger-jsdoc");

const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

const swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Joke Service API",
      version: "1.0.0",
      description: "API for retrieving jokes"
    },
    servers: [
      {
        url: "http://localhost:3000"
      }
    ]
  },
  apis: ["./app.js"],
};

const swaggerDocs = swaggerJsdoc(swaggerOptions);
app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerDocs));

/**
 * @swagger
 * /types:
 *   get:
 *     summary: Get all joke types
 *     responses:
 *       200:
 *         description: List of joke types
 */

/**
 * @swagger
 * /jokes/{type}:
 *   get:
 *     summary: Get jokes by type
 *     parameters:
 *       - in: path
 *         name: type
 *         required: true
 *         schema:
 *           type: string
 *         description: Joke type (e.g. programming, general, any)
 *       - in: query
 *         name: count
 *         schema:
 *           type: integer
 *         description: Number of jokes to return
 *     responses:
 *       200:
 *         description: List of jokes
 */

let db;

// ✅ SINGLE clean connect function
function connectDB() {
  db = mysql.createConnection({
    host: "database",
    user: "root",
    password: "root",
    database: "jokesdb"
  });

  db.connect(err => {
    if (err) {
      console.log("Waiting for MySQL...");
      setTimeout(connectDB, 2000);
    } else {
      console.log("Connected to MySQL!");
    }
  });
}

connectDB();


// ---------------- ROUTES ----------------

app.get("/types", (req, res) => {
  db.query("SELECT * FROM types", (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).send("Database error");
    }
    res.json(results);
  });
});

app.get("/jokes/:type", (req, res) => {

  const type = req.params.type;
  const count = parseInt(req.query.count) || 1;

  let sql;

  if (type === "any") {
    sql = `SELECT setup, punchline FROM jokes ORDER BY RAND() LIMIT ?`;

    db.query(sql, [count], (err, results) => {
      if (err) {
        console.error(err);
        return res.status(500).send("Error");
      }
      res.json(results);
    });

  } else {
    sql = `
      SELECT jokes.setup, jokes.punchline
      FROM jokes
      JOIN types ON jokes.type_id = types.id
      WHERE LOWER(types.name) = LOWER(?)
      ORDER BY RAND()
      LIMIT ?
    `;

    // 🔥 CORRECT ORDER
    db.query(sql, [type, count], (err, results) => {
      if (err) {
        console.error(err);
        return res.status(500).send("Error");
      }
      res.json(results);
    });
  }

});


// ✅ server start (keep this simple)
app.listen(3000, "0.0.0.0", () => {
  console.log("Joke service running on port 3000");
});