const API_URL = "http://localhost:3000"; 

let produtosDoBanco = [];
let usuarioLogado = null;

document.addEventListener("DOMContentLoaded", async () => {
    await carregarDadosUsuario();
    await carregarProdutos();
});

// 1. Carrega dados do usuário
async function carregarDadosUsuario() {
    const token = localStorage.getItem("token");
    
    if (!token) {
        document.getElementById("avisoLogin").classList.remove("d-none");
        document.getElementById("btnFinalizar").disabled = true;
        return;
    }

    try {
        const res = await fetch(`${API_URL}/auth/me`, {
            headers: { "Authorization": "Bearer " + token }
        });

        if (res.ok) {
            usuarioLogado = await res.json();
            document.getElementById("statusUsuario").classList.remove("d-none");
            document.getElementById("lblNome").innerText = usuarioLogado.nome;
            document.getElementById("lblRanque").innerText = usuarioLogado.ranque_nome;
            document.getElementById("lblSaldo").innerText = usuarioLogado.saldo_pontos;
            document.getElementById("lblSaldoResumo").innerText = usuarioLogado.saldo_pontos;
            document.getElementById("lblBeneficios").innerText = "Benefícios: " + usuarioLogado.ranque_beneficios;
        } else {
            localStorage.removeItem("token");
            window.location.href = "login.html";
        }
    } catch (error) {
        console.error("Erro ao buscar usuário:", error);
    }
}

// 2. Carrega produtos
async function carregarProdutos() {
    const container = document.getElementById("lista-produtos-container");
    
    try {
        const res = await fetch(`${API_URL}/compra/produtos`);
        produtosDoBanco = await res.json();

        container.innerHTML = ""; 

        if (produtosDoBanco.length === 0) {
            container.innerHTML = "<p>Nenhum produto disponível.</p>";
            return;
        }

        produtosDoBanco.forEach(prod => {
            const div = document.createElement("div");
            div.className = "card-produto d-flex justify-content-between align-items-center";
            
            // ALTERAÇÃO: Adicionei data-nome="${prod.nome}" para usar no resumo depois
            div.innerHTML = `
                <div class="form-check">
                    <input class="form-check-input item-compra" type="checkbox" 
                           value="${prod.idproduto}" 
                           id="prod-${prod.idproduto}"
                           data-nome="${prod.nome}" 
                           data-preco="${prod.preco_reais}"
                           data-pontos="${prod.preco_pontos}">
                    <label class="form-check-label" for="prod-${prod.idproduto}">
                        <strong>${prod.nome}</strong><br>
                        <small class="text-muted">${prod.descricao || ''}</small>
                    </label>
                </div>
                <div class="text-end">
                    <span class="d-block text-success fw-bold">R$ ${parseFloat(prod.preco_reais).toFixed(2)}</span>
                    <span class="d-block text-primary small">+ ${prod.preco_pontos} pts</span>
                    
                    <input type="number" min="1" value="1" class="form-control form-control-sm mt-1 qtd-input" 
                           style="width: 70px;" disabled id="qtd-${prod.idproduto}">
                </div>
            `;
            
            container.appendChild(div);
        });

        configurarEventosCalculo();

    } catch (error) {
        container.innerHTML = "<p class='text-danger'>Erro ao carregar produtos. Verifique se o servidor está rodando.</p>";
        console.error(error);
    }
}

function configurarEventosCalculo() {
    const checkboxes = document.querySelectorAll(".item-compra");
    const qtdInputs = document.querySelectorAll(".qtd-input");

    checkboxes.forEach(chk => {
        chk.addEventListener("change", (e) => {
            const id = e.target.value;
            const inputQtd = document.getElementById(`qtd-${id}`);
            inputQtd.disabled = !e.target.checked;
            calcularTotais();
        });
    });

    qtdInputs.forEach(input => {
        input.addEventListener("input", calcularTotais);
    });

    document.getElementById("usarPontosCheck").addEventListener("change", calcularTotais);
}

// 3. Cálculo e Atualização do Resumo (MODIFICADO)
function calcularTotais() {
    let totalReais = 0;
    let totalPontosGerados = 0;
    
    // Elemento da lista no HTML
    const listaResumo = document.getElementById("listaResumo");
    listaResumo.innerHTML = ""; // Limpa a lista atual

    const checkboxes = document.querySelectorAll(".item-compra:checked");

    if (checkboxes.length === 0) {
        listaResumo.innerHTML = '<li class="text-muted small">Nenhum item selecionado</li>';
    }

    checkboxes.forEach(chk => {
        const id = chk.value;
        const nome = chk.dataset.nome; // Pega o nome que guardamos
        const qtd = parseInt(document.getElementById(`qtd-${id}`).value) || 1;
        const preco = parseFloat(chk.dataset.preco);
        const pontosItem = parseInt(chk.dataset.pontos);

        const subtotal = preco * qtd;
        totalReais += subtotal;
        totalPontosGerados += pontosItem * qtd;

        // Adiciona item na lista visual do resumo
        const li = document.createElement("li");
        li.className = "d-flex justify-content-between small mb-1";
        li.innerHTML = `
            <span>${qtd}x ${nome}</span>
            <span>R$ ${subtotal.toFixed(2)}</span>
        `;
        listaResumo.appendChild(li);
    });

    // Atualiza Totais
    document.getElementById("totalReais").innerText = totalReais.toFixed(2).replace('.', ',');
    
    const usarPontos = document.getElementById("usarPontosCheck").checked;
    
    if (usarPontos) {
        const custoEmPontos = Math.ceil(totalReais * 100); 
        document.getElementById("totalPontosGanhar").innerText = "0 (Pagando com pontos)";
        document.getElementById("totalReais").innerHTML = `
            <span style="text-decoration: line-through">R$ ${totalReais.toFixed(2)}</span><br>
            <span class="text-danger">-${custoEmPontos} Pontos</span>
        `;
    } else {
        document.getElementById("totalPontosGanhar").innerText = totalPontosGerados;
        document.getElementById("totalReais").innerText = totalReais.toFixed(2).replace('.', ',');
    }
}

// 4. Enviar Compra
document.getElementById("formEncomenda").addEventListener("submit", async (e) => {
    e.preventDefault();
    
    const token = localStorage.getItem("token");
    if (!token) return alert("Faça login primeiro!");

    const checkboxes = document.querySelectorAll(".item-compra:checked");
    if (checkboxes.length === 0) return alert("Selecione pelo menos um item.");

    const usarPontos = document.getElementById("usarPontosCheck").checked;
    const saldoUsuario = usuarioLogado ? parseInt(usuarioLogado.saldo_pontos) : 0;
    
    let produtosParaEnviar = [];
    let valorTotalReais = 0;

    checkboxes.forEach(chk => {
        const id = chk.value;
        const qtd = parseInt(document.getElementById(`qtd-${id}`).value) || 1;
        const precoReais = parseFloat(chk.dataset.preco);
        const pontosGanho = parseInt(chk.dataset.pontos);

        produtosParaEnviar.push({
            idProduto: id,
            quantidade: qtd,
            preco_reais: precoReais,
            preco_pontos: usarPontos ? 0 : pontosGanho 
        });
        
        valorTotalReais += precoReais * qtd;
    });

    const pontosParaDeduzir = usarPontos ? Math.ceil(valorTotalReais * 100) : 0;

    if (usarPontos) {
        if (saldoUsuario < pontosParaDeduzir) {
            return alert(`Saldo insuficiente! Total: ${pontosParaDeduzir} pontos. Seu saldo: ${saldoUsuario}.`);
        }
        if (!confirm(`Confirmar pagamento de ${pontosParaDeduzir} pontos?`)) {
            return;
        }
    }

    const body = {
        produtos: produtosParaEnviar,
        valor_reais: usarPontos ? 0 : valorTotalReais,
        usar_pontos: pontosParaDeduzir 
    };

    try {
        const res = await fetch(`${API_URL}/compra`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": "Bearer " + token
            },
            body: JSON.stringify(body)
        });

        const json = await res.json();

        if (res.ok) {
            alert(`Sucesso! Compra ID: ${json.idCompra}. ${json.mensagem}`);
            window.location.reload(); 
        } else {
            alert("Erro: " + (json.erro || json.message));
        }

    } catch (err) {
        console.error(err);
        alert("Erro ao conectar com servidor.");
    }
});