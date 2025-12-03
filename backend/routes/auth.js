const express = require("express");
const router = express.Router();
const pool = require("../db");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const JWT_SECRET = "segredo_super_forte"; // Deve ser igual ao usado no authMiddleware

// ROTA: Cadastro de Usuário
router.post("/register", async (req, res) => {
    try {
        const { nome, email, senha, telefone, cpf, endereco } = req.body;

        if (!senha || senha.length < 6) {
            return res.status(400).json({ erro: "A senha deve ter no mínimo 6 caracteres." });
        }
        // 1. Verificar se usuário já existe
        const userCheck = await pool.query("SELECT * FROM Cliente WHERE email = $1", [email]);
        if (userCheck.rows.length > 0) {
            return res.status(400).json({ erro: "Email já cadastrado." });
        }

        // 2. Criptografar a senha
        const salt = await bcrypt.genSalt(10);
        const senhaHash = await bcrypt.hash(senha, salt);

        // 3. Inserir no banco (Ranque 1 = Bronze por padrão)
        const newUser = await pool.query(
            `INSERT INTO Cliente (nome, email, senha_hash, telefone, cpf, endereco, fk_Ranque_idRanque) 
             VALUES ($1, $2, $3, $4, $5, $6, 1) RETURNING idCliente, nome, email`,
            [nome, email, senhaHash, telefone, cpf, endereco]
        );

        res.status(201).json({ message: "Usuário criado com sucesso!", user: newUser.rows[0] });

    } catch (err) {
        console.error(err);
        res.status(500).json({ erro: "Erro ao cadastrar usuário." });
    }
});

// ROTA: Login
router.post("/login", async (req, res) => {
    try {
        const { email, senha } = req.body;

        // 1. Buscar usuário
        const userResult = await pool.query("SELECT * FROM Cliente WHERE email = $1", [email]);
        if (userResult.rows.length === 0) {
            return res.status(400).json({ erro: "Usuário ou senha inválidos." });
        }

        const usuario = userResult.rows[0];

        // 2. Comparar senha criptografada
        const validPassword = await bcrypt.compare(senha, usuario.senha_hash);
        if (!validPassword) {
            return res.status(400).json({ erro: "Usuário ou senha inválidos." });
        }

        // 3. Gerar Token
        const token = jwt.sign(
            { idCliente: usuario.idcliente, nome: usuario.nome },
            JWT_SECRET,
            { expiresIn: "1h" }
        );

        res.json({
            sucesso: true,
            token,
            nome: usuario.nome,
            idCliente: usuario.idcliente
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ erro: "Erro interno no servidor." });
    }
});

// ROTA: Pegar informações do usuário logado (Perfil)
router.get("/me", async (req, res) => {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ erro: "Token ausente" });

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const result = await pool.query(`
            SELECT c.idCliente, c.nome, c.email, c.telefone, c.endereco, 
                   c.saldo_pontos, c.pontos_ranque, r.nome AS ranque_nome, r.beneficios AS ranque_beneficios
            FROM Cliente c
            JOIN Ranque r ON r.idRanque = c.fk_Ranque_idRanque
            WHERE c.idCliente = $1
        `, [decoded.idCliente]);

        if (result.rows.length === 0) return res.status(404).json({ erro: "Cliente não encontrado" });
        
        res.json(result.rows[0]);
    } catch (e) {
        res.status(401).json({ erro: "Token inválido" });
    }
});

module.exports = router;

// ROTA: Deletar Usuário e suas Compras
router.delete("/delete", async (req, res) => {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ erro: "Token ausente" });

    const client = await pool.connect();

    try {
        // 1. Validar Token
        const decoded = jwt.verify(token, JWT_SECRET);
        const idCliente = decoded.idCliente;

        await client.query("BEGIN");

        // 2. Deletar Histórico de Recompensas (se houver, devido ao CASCADE pode ser automático, mas garantimos aqui)
        await client.query("DELETE FROM Cliente_Recompensa WHERE fk_Cliente_idCliente = $1", [idCliente]);

        // 3. Deletar Compras (Isso vai disparar o CASCADE para Compra_Produto automaticamente)
        await client.query("DELETE FROM Compra WHERE fk_Cliente_idCliente = $1", [idCliente]);

        // 4. Deletar o Cliente
        const result = await client.query("DELETE FROM Cliente WHERE idCliente = $1 RETURNING nome", [idCliente]);

        await client.query("COMMIT");

        if (result.rowCount === 0) {
            return res.status(404).json({ erro: "Cliente não encontrado." });
        }

        res.json({ sucesso: true, mensagem: `Conta de ${result.rows[0].nome} excluída com sucesso.` });

    } catch (err) {
        await client.query("ROLLBACK");
        console.error("Erro ao deletar conta:", err);
        res.status(500).json({ erro: "Erro ao excluir conta." });
    } finally {
        client.release();
    }
});

module.exports = router;