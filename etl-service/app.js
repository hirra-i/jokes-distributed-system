const amqp = require('amqplib');
const mysql = require('mysql2');

let db;
let channel;

// Connect to MySQL with retry
function connectDB() {
  db = mysql.createConnection({
    host: 'database',
    user: 'root',
    password: 'root',
    database: 'jokesdb'
  });

  db.connect((err) => {
    if (err) {
      console.log("MySQL not ready, retrying in 5 seconds...");
      setTimeout(connectDB, 5000);
    } else {
      console.log("Connected to MySQL!");
      connectRabbitMQ();
    }
  });
}

// Connect to RabbitMQ with retry
function connectRabbitMQ() {
  amqp.connect('amqp://rabbitmq')
    .then((connection) => connection.createChannel())
    .then((ch) => {
      channel = ch;
      console.log("Connected to RabbitMQ!");
      startConsumer();
    })
    .catch(() => {
      console.log("RabbitMQ not ready, retrying in 5 seconds...");
      setTimeout(connectRabbitMQ, 5000);
    });
}

// Start consuming messages
function startConsumer() {
  const queue = 'jokes';

  channel.assertQueue(queue, { durable: true });

  console.log('ETL Service waiting for messages...');

  channel.consume(queue, (msg) => {
    if (msg !== null) {
      const joke = JSON.parse(msg.content.toString());
      console.log('Received joke:', joke);

      const { setup, punchline, type } = joke;

      db.query('SELECT id FROM types WHERE name = ?', [type], (err, results) => {
        if (err) return console.log(err);

        let typeId;

        if (results.length === 0) {
          db.query('INSERT INTO types (name) VALUES (?)', [type], (err, result) => {
            if (err) return console.log(err);
            typeId = result.insertId;
            insertJoke(typeId);
          });
        } else {
          typeId = results[0].id;
          insertJoke(typeId);
        }
      });

      function insertJoke(typeId) {
        db.query(
          'INSERT INTO jokes (setup, punchline, type_id) VALUES (?, ?, ?)',
          [setup, punchline, typeId],
          (err) => {
            if (err) return console.log(err);
            console.log('Joke inserted into database');
            channel.ack(msg);
          }
        );
      }
    }
  });
}

// Start everything
connectDB();