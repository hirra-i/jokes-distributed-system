
USE jokesdb;

CREATE TABLE types (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50)
);

CREATE TABLE jokes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    type_id INT,
    setup TEXT,
    punchline TEXT
);

INSERT INTO types (name) VALUES
('general'),
('programming'),
('dad');

INSERT INTO jokes (type_id, setup, punchline) VALUES
(1,'Why did the chicken cross the road?','To get to the other side'),
(2,'Why do programmers hate nature?','Too many bugs'),
(3,'Why don’t skeletons fight each other?','They don’t have the guts');