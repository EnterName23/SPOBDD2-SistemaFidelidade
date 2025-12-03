CREATE TABLE Ranque (
    idRanque SERIAL PRIMARY KEY,
    nome VARCHAR(50) NOT NULL UNIQUE,
    pontuacao_minima INTEGER NOT NULL,
    beneficios TEXT
);

DROP TABLE IF EXISTS Cliente CASCADE;

CREATE TABLE Cliente (
    idCliente SERIAL PRIMARY KEY,

    email VARCHAR(100) NOT NULL UNIQUE,
    telefone VARCHAR(20),
    cpf VARCHAR(14) UNIQUE,
    endereco TEXT,
    nome VARCHAR(100) NOT NULL,
    senha_hash TEXT NOT NULL,
    fk_Ranque_idRanque INTEGER NOT NULL,

    saldo_pontos INTEGER NOT NULL DEFAULT 0,
    pontos_ranque INTEGER NOT NULL DEFAULT 0,

    FOREIGN KEY (fk_Ranque_idRanque)
        REFERENCES Ranque(idRanque)
);


CREATE TABLE Produto (
    idProduto SERIAL PRIMARY KEY,
    preco_reais NUMERIC(10, 2) NOT NULL,
    qtdEstoque INTEGER NOT NULL DEFAULT 0,
    descricao TEXT,
    nome VARCHAR(100) NOT NULL,
    preco_pontos INTEGER NOT NULL DEFAULT 0
);


CREATE TABLE Compra (
    idCompra SERIAL PRIMARY KEY,
    observacoes TEXT,
    valor_pago_reais NUMERIC(10, 2) NOT NULL,
    pontos_ranque_gerados INTEGER NOT NULL,
    pontos_gerados INTEGER NOT NULL,
    data_compra TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fk_Cliente_idCliente INTEGER NOT NULL,
    
    FOREIGN KEY (fk_Cliente_idCliente)
        REFERENCES Cliente(idCliente)
        ON DELETE RESTRICT
);

CREATE TABLE Compra_Produto (
    fk_Compra_idCompra INTEGER NOT NULL,
    fk_Produto_idProduto INTEGER NOT NULL,
    quantidade INTEGER NOT NULL,
    preco_unitario_reais NUMERIC(10, 2) NOT NULL,
    preco_unitario_pontos INTEGER NOT NULL DEFAULT 0,
    
    PRIMARY KEY (fk_Compra_idCompra, fk_Produto_idProduto),

    FOREIGN KEY (fk_Compra_idCompra)
        REFERENCES Compra(idCompra)
        ON DELETE CASCADE,

    FOREIGN KEY (fk_Produto_idProduto)
        REFERENCES Produto(idProduto)
        ON DELETE RESTRICT
);


CREATE TABLE Recompensa (
    idRecompensa SERIAL PRIMARY KEY,
    valor_pago_pontos INTEGER NOT NULL,
    observacoes TEXT,
    data_recompensa DATE NOT NULL,
    quantidade INTEGER NOT NULL
);


CREATE TABLE Cliente_Recompensa (
    idClienteRecompensa SERIAL PRIMARY KEY,
    fk_Cliente_idCliente INTEGER NOT NULL,
    fk_Recompensa_idRecompensa INTEGER NOT NULL,
    data_resgate TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (fk_Cliente_idCliente)
        REFERENCES Cliente(idCliente)
        ON DELETE CASCADE,

    FOREIGN KEY (fk_Recompensa_idRecompensa)
        REFERENCES Recompensa(idRecompensa)
        ON DELETE RESTRICT
);

CREATE OR REPLACE FUNCTION fn_get_ranque_id_by_pontos(pontos INT)
RETURNS INT
LANGUAGE plpgsql
AS $$
DECLARE 
    v_ranque_id INT;
BEGIN
    SELECT idRanque
    INTO v_ranque_id
    FROM Ranque
    WHERE pontuacao_minima <= COALESCE(pontos, 0)
    ORDER BY pontuacao_minima DESC
    LIMIT 1;

    RETURN v_ranque_id;
END;
$$;

CREATE OR REPLACE FUNCTION fn_promover_cliente_se_eligivel(p_cliente_id INT)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
    v_ranque_atual INT;
    v_novo_ranque INT;
    v_pontos_ranque INT;
BEGIN
    SELECT fk_Ranque_idRanque, pontos_ranque
    INTO v_ranque_atual, v_pontos_ranque
    FROM Cliente
    WHERE idCliente = p_cliente_id;

    IF NOT FOUND THEN
        RETURN 'O cliente não foi encontrado';
    END IF;

    v_novo_ranque := fn_get_ranque_id_by_pontos(v_pontos_ranque);

    IF v_novo_ranque IS NOT NULL 
       AND v_novo_ranque <> v_ranque_atual THEN

        UPDATE Cliente
        SET fk_Ranque_idRanque = v_novo_ranque
        WHERE idCliente = p_cliente_id;

        RETURN format(
            'Cliente promovido: Ranque %s → %s', 
            v_ranque_atual, v_novo_ranque
        );
    END IF;

    RETURN 'Sem alteração de ranque';
END;
$$;

CREATE OR REPLACE FUNCTION fn_recalcular_pontos_compra(p_compra_id INT)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
    v_cliente_id INT;
    v_total_pontos INT := 0;
    v_total_pontos_ranque INT := 0;
    v_antigos_pontos INT := 0;
    v_antigos_pontos_ranque INT := 0;
BEGIN
    SELECT fk_Cliente_idCliente
    INTO v_cliente_id
    FROM Compra
    WHERE idCompra = p_compra_id;

    IF v_cliente_id IS NULL THEN
        RETURN 'Compra não encontrada';
    END IF;

    SELECT COALESCE(SUM(preco_unitario_pontos * quantidade), 0)
    INTO v_total_pontos
    FROM Compra_Produto
    WHERE fk_Compra_idCompra = p_compra_id;

    v_total_pontos_ranque := v_total_pontos;

    SELECT COALESCE(pontos_gerados, 0), 
           COALESCE(pontos_ranque_gerados, 0)
    INTO v_antigos_pontos, v_antigos_pontos_ranque
    FROM Compra
    WHERE idCompra = p_compra_id;

    UPDATE Compra
    SET pontos_gerados = v_total_pontos,
        pontos_ranque_gerados = v_total_pontos_ranque
    WHERE idCompra = p_compra_id;

    UPDATE Cliente
    SET saldo_pontos = saldo_pontos + (v_total_pontos - v_antigos_pontos),
        pontos_ranque = pontos_ranque + (v_total_pontos_ranque - v_antigos_pontos_ranque)
    WHERE idCliente = v_cliente_id;

    PERFORM fn_promover_cliente_se_eligivel(v_cliente_id);

    RETURN 'Pontos recalculados com sucesso';
END;
$$;

CREATE OR REPLACE FUNCTION fn_resgatar_recompensa(
    p_cliente_id INT,
    p_recompensa_id INT
)
RETURNS TABLE(
    success BOOLEAN,
    message TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_custo INT;
    v_qtd INT;
    v_saldo INT;
BEGIN
    SELECT valor_pago_pontos, quantidade
    INTO v_custo, v_qtd
    FROM Recompensa
    WHERE idRecompensa = p_recompensa_id;

    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, 'Recompensa não encontrada';
        RETURN;
    END IF;

    IF v_qtd <= 0 THEN
        RETURN QUERY SELECT FALSE, 'Estoque insuficiente';
        RETURN;
    END IF;

    SELECT saldo_pontos
    INTO v_saldo
    FROM Cliente
    WHERE idCliente = p_cliente_id;

    IF v_saldo < v_custo THEN
        RETURN QUERY SELECT FALSE, 'Saldo insuficiente';
        RETURN;
    END IF;

    UPDATE Cliente
    SET saldo_pontos = saldo_pontos - v_custo
    WHERE idCliente = p_cliente_id;

    UPDATE Recompensa
    SET quantidade = quantidade - 1
    WHERE idRecompensa = p_recompensa_id;

    INSERT INTO Cliente_Recompensa(fk_Cliente_idCliente, fk_Recompensa_idRecompensa)
    VALUES (p_cliente_id, p_recompensa_id);

    RETURN QUERY SELECT TRUE, 'Recompensa resgatada com sucesso';
END;
$$;

CREATE OR REPLACE FUNCTION trg_compra_produto_after_insert_fn()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    PERFORM fn_recalcular_pontos_compra(NEW.fk_Compra_idCompra);
    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_compra_produto_after_insert ON Compra_Produto;

CREATE TRIGGER trg_compra_produto_after_insert
AFTER INSERT ON Compra_Produto
FOR EACH ROW
EXECUTE FUNCTION trg_compra_produto_after_insert_fn();

CREATE OR REPLACE FUNCTION trg_compra_produto_after_update_fn()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.fk_Compra_idCompra IS DISTINCT FROM OLD.fk_Compra_idCompra THEN
        PERFORM fn_recalcular_pontos_compra(OLD.fk_Compra_idCompra);
        PERFORM fn_recalcular_pontos_compra(NEW.fk_Compra_idCompra);
    ELSE
        PERFORM fn_recalcular_pontos_compra(NEW.fk_Compra_idCompra);
    END IF;

    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_compra_produto_after_update ON Compra_Produto;

CREATE TRIGGER trg_compra_produto_after_update
AFTER UPDATE ON Compra_Produto
FOR EACH ROW
EXECUTE FUNCTION trg_compra_produto_after_update_fn();


CREATE OR REPLACE FUNCTION trg_compra_produto_after_delete_fn()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    PERFORM fn_recalcular_pontos_compra(OLD.fk_Compra_idCompra);
    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_compra_produto_after_delete ON Compra_Produto;

CREATE TRIGGER trg_compra_produto_after_delete
AFTER DELETE ON Compra_Produto
FOR EACH ROW
EXECUTE FUNCTION trg_compra_produto_after_delete_fn();


CREATE OR REPLACE FUNCTION trg_prevent_negative_saldo_fn()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.saldo_pontos < 0 THEN
        RAISE EXCEPTION 'Operação inválida: saldo_pontos não pode ser negativo (%).', NEW.saldo_pontos;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_negative_saldo ON Cliente;

CREATE TRIGGER trg_prevent_negative_saldo
BEFORE UPDATE ON Cliente
FOR EACH ROW
EXECUTE FUNCTION trg_prevent_negative_saldo_fn();


CREATE OR REPLACE VIEW vw_cliente_ranque AS
SELECT 
    c.idCliente,
    c.nome,
    c.email,
    c.telefone,
    c.cpf,
    c.endereco,
    c.saldo_pontos,
    c.pontos_ranque,
    r.nome AS nome_ranque,
    r.beneficios
FROM Cliente c
JOIN Ranque r ON r.idRanque = c.fk_Ranque_idRanque;

CREATE OR REPLACE VIEW vw_produtos AS
SELECT 
    idProduto,
    nome,
    descricao,
    preco_reais,
    preco_pontos,
    qtdEstoque
FROM Produto
WHERE qtdEstoque > 0;

CREATE OR REPLACE VIEW vw_compras_detalhadas AS
SELECT
    c.idCompra,
    c.data_compra,
    c.valor_pago_reais,
    c.pontos_gerados,
    c.pontos_ranque_gerados,
    p.idProduto,
    p.nome AS produto_nome,
    cp.quantidade,
    cp.preco_unitario_reais,
    cp.preco_unitario_pontos,
    c.fk_Cliente_idCliente
FROM Compra c
JOIN Compra_Produto cp ON cp.fk_Compra_idCompra = c.idCompra
JOIN Produto p ON p.idProduto = cp.fk_Produto_idProduto;




BEGIN;
INSERT INTO Ranque (idRanque, nome, pontuacao_minima, beneficios) VALUES
(1, 'Bronze', 0, 'Nenhum Benefício'),
(2, 'Prata', 1000, 'Uma Flor extra a cada 30R$'),
(3, 'Ouro', 2000, 'Uma flor Extra a Cada 20R$'),
(4, 'Platina', 3000, 'Uma flor Extra a cada 15R$');
COMMIT;

INSERT INTO Produto (nome, descricao, preco_reais, preco_pontos, qtdEstoque)
VALUES
-- ARRANJOS
('Arranjo Primavera', 'Flores frescas da estação com montagem artística.', 79.90, 800, 50),
('Buquê Romântico', 'Rosas vermelhas selecionadas com embalagem especial.', 129.90, 1200, 40),
('Arranjo Tropical', 'Flores exóticas e vibrantes.', 95.00, 900, 30),

-- CESTAS
('Cesta de Café da Manhã', 'Cesta com frutas, pães, flores e chocolate.', 149.90, 1500, 20),
('Cesta de Chocolates', 'Seleção especial de chocolates em embalagem premium.', 89.90, 900, 25),
('Cesta Floral', 'Cesta decorada com mini arranjo de flores.', 69.90, 700, 30),

('Rosa Vermelha Unitária', 'Rosa vermelha premium de alta durabilidade.', 12.00, 120, 200),
('Girassol Unitário', 'Flor de girassol com haste longa.', 9.50, 95, 180),
('Orquídea Branca', 'Orquídea phalaenopsis branca, vaso incluso.', 139.90, 1400, 15),

-- PRODUTOS ESPECIAIS
('Vela Aromática', 'Vela artesanal com aroma floral.', 29.90, 300, 60),
('Cartão Personalizado', 'Cartão com mensagem personalizada para presente.', 7.00, 70, 100),
('Pelúcia Floral', 'Urso de pelúcia segurando mini-rosa decorativa.', 49.90, 500, 40);

-- FLORES
    ('Rosa Vermelha', 'Clássica flor que simboliza o amor e a paixão.', 5.00, 50, 50),
    ('Girassol', 'Conhecido por seguir o sol, simboliza felicidade e lealdade.', 7.50, 50, 75),
    ('Orquídea Phalaenopsis', 'Elegante e duradoura, perfeita para presentes sofisticados.', 45.00, 50, 450),
    ('Lírio Branco', 'Simboliza a pureza, inocência e a paz.', 9.00, 50, 90),
    ('Margarida', 'Representa a simplicidade, juventude e o ''bem-me-quer''.', 3.50, 50, 35),
    ('Tulipa Vermelha', 'Símbolo de amor perfeito e elegância. Muito popular na primavera.', 6.00, 50, 60),
    ('Gérbera Colorida', 'Representa a alegria, energia e pureza. Disponível em várias cores vibrantes.', 4.00, 50, 40),
    ('Cravo Branco', 'Associado ao amor puro e boa sorte. Uma flor tradicional e duradoura.', 3.00, 50, 30),
    ('Azaleia Rosa', 'Arbusto que simboliza a perseverança e a feminilidade. Ótima para vasos.', 35.00, 50, 350),
    ('Bromélia Guzmania', 'Flor tropical exótica, simboliza a inspiração e a resistência.', 55.00, 50, 550),
    ('Hortênsia Azul', 'Simboliza a devoção, gratidão e a abundância. A cor pode variar com o pH do solo.', 15.00, 50, 150),
    ('Violeta Africana', 'Pequena e delicada, perfeita para interiores. Simboliza a modéstia e a lealdade.', 12.00, 50, 120),
    ('Antúrio Vermelho', 'Com sua folha brilhante em forma de coração, representa a hospitalidade.', 40.00, 50, 400),
    ('Copo-de-leite', 'Flor nobre e sofisticada, usada em casamentos por simbolizar a pureza.', 8.00, 50, 80),
	('Rosa Vermelha Unitária', 'Rosa vermelha premium de alta durabilidade.', 12.00, 120, 200),
	('Girassol Unitário', 'Flor de girassol com haste longa.', 9.50, 95, 180),
	('Orquídea Branca', 'Orquídea phalaenopsis branca, vaso incluso.', 139.90, 1400, 15);

BEGIN;


	