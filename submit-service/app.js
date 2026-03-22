const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");
const swaggerUi = require("swagger-ui-express");
const swaggerJsdoc = require("swagger-jsdoc");
const amqp = require('amqplib');

const app = express();
const http = require("http");
const fs = require("fs");
const path = require("path");

const cacheFile = path.join(__dirname, "cache", "types.json");

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

async function sendToQueue(joke) {
  try {
    const connection = await amqp.connect('amqp://rabbitmq');
    const channel = await connection.createChannel();
    const queue = 'jokes';

    await channel.assertQueue(queue, { durable: true });
    channel.sendToQueue(queue, Buffer.from(JSON.stringify(joke)));

    console.log("Sent to queue:", joke);

    setTimeout(() => {
      connection.close();
    }, 500);
  } catch (error) {
    console.error("RabbitMQ error:", error);
  }
}
// ---------------- ROUTES ----------------

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
 *         description: Joke sent to queue successfully
 */
app.get("/types", (req, res) => {
  http.get("http://joke-service:3000/types", (response) => {
    let data = "";

    response.on("data", (chunk) => {
      data += chunk;
    });

    response.on("end", () => {
      const types = JSON.parse(data);

      // Save to cache file
      fs.writeFileSync(cacheFile, JSON.stringify(types, null, 2));
      console.log("Types saved to cache file");

      res.json(types);
    });
  }).on("error", () => {
    console.log("Joke service down, reading from cache");

    // Read from cache file
    if (fs.existsSync(cacheFile)) {
      const data = fs.readFileSync(cacheFile);
      const types = JSON.parse(data);
      res.json(types);
    } else {
      res.status(500).json({ error: "No cache file found" });
    }
  });
});

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
app.post("/submit", async (req, res) => {
  const { setup, punchline, type } = req.body;

  try {
    const connection = await amqp.connect('amqp://rabbitmq');
    const channel = await connection.createChannel();

    const queue = 'jokes';
    await channel.assertQueue(queue, { durable: true });

    const joke = { setup, punchline, type };

    channel.sendToQueue(queue, Buffer.from(JSON.stringify(joke)), {
      persistent: true
    });

    console.log("Joke sent to RabbitMQ:", joke);

    res.json({ message: "Joke sent to queue successfully" });

  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Failed to send joke to queue" });
  }
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

