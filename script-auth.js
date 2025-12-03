const AUTH_API = "http://localhost:3000/auth";

/* =========================================================================
   LÓGICA DE CADASTRO (Corrigida)
   ========================================================================= */
const formCadastro = document.getElementById("formCadastro"); 

if (formCadastro) {
    formCadastro.addEventListener("submit", async (e) => {
        e.preventDefault(); 

        // ============================================================
        // 1. TRAVA DE SEGURANÇA
        // Se qualquer validação falhar, o código PARA aqui (return)
        // ============================================================
        
        // VERIFICAÇÕES
        if (typeof validarNome === "function" && !validarNome()) return;
        if (typeof validarEmail === "function" && !validarEmail()) return;
        if (typeof validarTelefone === "function" && !validarTelefone()) return;
        if (typeof validarCPF === "function" && !validarCPF()) return;
        if (typeof validarEndereco === "function" && !validarEndereco()) return;
        
        if (typeof validarSenha === "function") {
            const senhaValida = validarSenha(true); 
            if (!senhaValida) {
                return; 
            }
        }

        const msgDiv = document.getElementById("msg");
        if (msgDiv) msgDiv.textContent = "Processando...";

        try {
            const formData = new FormData(e.target);
            const dados = Object.fromEntries(formData);
            
            // Limpeza de máscaras
            if (dados.cpf) dados.cpf = dados.cpf.replace(/\D/g, ''); 
            if (dados.telefone) dados.telefone = dados.telefone.replace(/\D/g, '');

            const res = await fetch(AUTH_API + "/register", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(dados)
            });

            const json = await res.json();

            if (res.ok) {
                alert("Cadastro realizado com sucesso!");
                window.location.href = "login.html";
            } else {
                if (msgDiv) {
                    msgDiv.textContent = json.erro || json.message;
                    msgDiv.style.color = "red";
                } else {
                    alert(json.erro || json.message);
                }
            }
        } catch (error) {
            console.error(error);
            alert("Erro de conexão com o servidor.");
        }
    });
}

/* =========================================================================
   LÓGICA DE LOGIN
   ========================================================================= */
const formLogin = document.getElementById("formLogin");

if (formLogin) {
    formLogin.addEventListener("submit", async (e) => {
        e.preventDefault();

        if (typeof validarEmail === "function" && !validarEmail()) return;
        if (typeof validarSenha === "function" && !validarSenha(false)) return;

        const msgDiv = document.getElementById("msg");
        if (msgDiv) msgDiv.textContent = "Entrando...";

        try {
            const dados = Object.fromEntries(new FormData(e.target));

            const res = await fetch(AUTH_API + "/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(dados)
            });

            const json = await res.json();

            if (res.ok) {
                localStorage.setItem("token", json.token);
                localStorage.setItem("nome", json.nome);

                if (msgDiv) {
                    msgDiv.textContent = "Login realizado! Redirecionando...";
                    msgDiv.style.color = "green";
                }

                setTimeout(() => {
                    window.location.href = "../home.html"; 
                }, 1000);
            } else {
                if (msgDiv) {
                    msgDiv.textContent = json.erro || "Dados incorretos";
                    msgDiv.style.color = "red";
                } else {
                    alert(json.erro);
                }
            }
        } catch (error) {
            console.error(error);
            if (msgDiv) msgDiv.textContent = "Erro ao conectar com o servidor.";
        }
    });
}


// Verifica se o jQuery está carregado antes de tentar aplicar máscaras
if (typeof $ !== 'undefined' && $.fn.mask) {
    $(document).ready(function(){
        $('#cpf').mask('000.000.000-00');
        $('#telefone').mask('(00) 00000-0000');
    });
} else {
    console.warn("jQuery ou jQuery Mask Plugin não encontrados. As máscaras não funcionarão.");
}