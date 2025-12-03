const express = require("express");
const cors = require("cors");
const app = express();

// Middlewares globais
app.use(cors());
app.use(express.json());

// Rotas
const authRoutes = require("./routes/auth");
const compraRoutes = require("./routes/compra");

app.use("/auth", authRoutes);
app.use("/compra", compraRoutes);

app.listen(3000, () => {
    console.log("Servidor rodando em http://localhost:3000");
});
