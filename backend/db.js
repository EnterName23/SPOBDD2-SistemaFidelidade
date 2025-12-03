const { Pool } = require("pg");

const pool = new Pool({
    user: "postgres",
    host: "localhost",
    database: "BDD2_PROJETO_S",
    password: "SENHA",
    port: 5432
});

module.exports = pool;
