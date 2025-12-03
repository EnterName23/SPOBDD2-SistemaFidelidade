const express = require("express");
const pool = require("../db");
const jwt = require("jsonwebtoken");
const router = express.Router();
const JWT_SECRET = "segredo_super_forte";

// Middleware local de autenticação
function auth(req, res, next) {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ erro: "Token não fornecido" });
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(401).json({ erro: "Token inválido" });
    }
    
}

// ROTA: Listar Produtos
router.get("/produtos", async (req, res) => {
    try {
        // Usa a VIEW criada no banco
        const produtos = await pool.query("SELECT * FROM vw_produtos");
        res.json(produtos.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ erro: "Erro ao buscar produtos" });
    }
});

// ROTA: Criar Compra
router.post("/", auth, async (req, res) => {
    const client = await pool.connect();
    try {
        const { produtos, valor_reais, usar_pontos } = req.body;
        const idCliente = req.user.idCliente;

        await client.query("BEGIN");

        // Validação de saldo de pontos
        if (usar_pontos) {
            const check = await client.query("SELECT saldo_pontos FROM Cliente WHERE idCliente = $1", [idCliente]);
            if (check.rows[0].saldo_pontos < usar_pontos) {
                await client.query("ROLLBACK");
                return res.status(400).json({ erro: "Pontos insuficientes" });
            }
        }

        // 1. Criar a Compra
        // Note: pontos_gerados iniciam com 0, o TRIGGER do banco vai calcular isso depois
        const insertCompra = await client.query(`
            INSERT INTO Compra(valor_pago_reais, pontos_gerados, pontos_ranque_gerados, fk_Cliente_idCliente)
            VALUES ($1, 0, 0, $2)
            RETURNING idCompra
        `, [valor_reais, idCliente]);

        const idCompra = insertCompra.rows[0].idcompra;

        // 2. Inserir Itens da Compra
        for (const p of produtos) {
            await client.query(`
                INSERT INTO Compra_Produto(fk_Compra_idCompra, fk_Produto_idProduto, quantidade, preco_unitario_reais, preco_unitario_pontos)
                VALUES ($1, $2, $3, $4, $5)
            `, [idCompra, p.idProduto, p.quantidade, p.preco_reais, p.preco_pontos]);
        }

        if (usar_pontos > 0) {
            console.log(`Deduzindo ${usar_pontos} pontos do cliente ${idCliente}`); // Log para debug
            
            await client.query(`
                UPDATE Cliente 
                SET saldo_pontos = saldo_pontos - $1 
                WHERE idCliente = $2
            `, [usar_pontos, idCliente]);
        }

        await client.query("COMMIT");

        res.json({ sucesso: true, mensagem: "Compra realizada!", idCompra });

    } catch (err) {
        await client.query("ROLLBACK");
        console.error(err);
        res.status(500).json({ erro: "Erro ao processar compra" });
    } finally {
        client.release();
    }
});

module.exports = router;