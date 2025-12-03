/* =========================================================================
   CONFIGURAÇÕES GLOBAIS E UTILITÁRIOS
   ========================================================================= */
const API_URL_BASE = "http://localhost:3000";

function exibirErroEfocar(idCampo, mensagem) {
    const campo = document.getElementById(idCampo);
    const msgBox = document.getElementById("msg"); 
    
    if (campo) {
        campo.classList.add('is-invalid');
        campo.classList.remove('is-valid');
        campo.focus();
    }
    
    if (msgBox) {
        msgBox.textContent = mensagem;
        msgBox.style.color = "red";
    } else {
        alert(mensagem); 
    }
}

function limparErro(idCampo) {
    const campo = document.getElementById(idCampo);
    if (campo) {
        campo.classList.remove('is-invalid');
        if (campo.value.trim().length > 0) campo.classList.add('is-valid');
    }
}

/* =========================================================================
   VALIDAÇÕES
   ========================================================================= */
function validarNome() {
    const campo = document.getElementById('nome');
    if (!campo) return true;
    if (campo.value.trim() === "") {
        exibirErroEfocar('nome', "O campo nome é obrigatório.");
        return false;
    }
    limparErro('nome');
    return true;
}

function validarEmail() {
    const campo = document.getElementById('email');
    if (!campo) return true;
    const reEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    if (campo.value.trim() === "") {
        exibirErroEfocar('email', "O campo Email é obrigatório.");
        return false;
    }
    if (!reEmail.test(campo.value.trim())) {
        exibirErroEfocar('email', "Insira um email válido.");
        return false;
    }
    limparErro('email');
    return true;
}

function validarTelefone() {
    // Pega o campo 'telefone' ou 'celular' dependendo do ID usado no HTML
    const campo = document.getElementById('telefone') || document.getElementById('celular');
    if (!campo) return true;
    
    // CORREÇÃO: Regex ajustada para o formato exato da máscara (XX) XXXXX-XXXX
    const reTelefone = /^\(\d{2}\) \d{5}-\d{4}$/;
    
    if (campo.value.trim() === "") {
        exibirErroEfocar(campo.id, "O campo Telefone é obrigatório.");
        return false;
    }
    if (!reTelefone.test(campo.value.trim())) {
        exibirErroEfocar(campo.id, "Formato inválido. Use (XX) XXXXX-XXXX.");
        return false;
    }
    limparErro(campo.id);
    return true;
}

function validarCPF() {
    const campo = document.getElementById('cpf');
    if (!campo) return true;
    const reCPF = /^\d{3}\.\d{3}\.\d{3}-\d{2}$/;

    if (campo.value.trim() === "") {
        exibirErroEfocar('cpf', "O CPF é obrigatório.");
        return false;
    }
    if (!reCPF.test(campo.value.trim())) {
        exibirErroEfocar('cpf', "CPF inválido. Use XXX.XXX.XXX-XX");
        return false;
    }
    limparErro('cpf');
    return true;
}

function validarEndereco() {
    const campo = document.getElementById('endereco');
    if (!campo) return true;
    if (campo.value.trim() === "") {
        exibirErroEfocar('endereco', "O Endereço é obrigatório.");
        return false;
    }
    limparErro('endereco');
    return true;
}

function validarSenha(isCadastro = false) {
    const campo = document.getElementById('senha');
    if (!campo) return true;
    
    if (campo.value.length === 0) {
        exibirErroEfocar('senha', "A Senha é obrigatória.");
        return false;
    }
    
    if (isCadastro) {
        if (campo.value.length < 6) {
            exibirErroEfocar('senha', "A senha deve ter no mínimo 6 caracteres.");
            return false;
        }
        const regexComplexidade = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/;
        if (!regexComplexidade.test(campo.value)) {
            exibirErroEfocar('senha', "A senha precisa de letras maiúsculas, minúsculas e números.");
            return false;
        }
    }
    limparErro('senha');
    return true;
}

/* =========================================================================
   FUNÇÕES GLOBAIS
   ========================================================================= */

function atualizarMenuUsuario() {
    const userArea = document.getElementById("userArea");
    if (!userArea) return;

    const token = localStorage.getItem("token");
    const nome = localStorage.getItem("nome");

    if (!token) {
        const pathPrefix = window.location.pathname.includes('/pages/') ? '' : 'pages/';
        userArea.innerHTML = `<a href="${pathPrefix}login.html" class="btn btn-danger ms-3">Entrar</a>`;
        return;
    }

    const loginPath = window.location.pathname.includes('/pages/') ? 'login.html' : 'pages/login.html';

    userArea.innerHTML = `
        <div class="dropdown ms-3">
            <button class="btn btn-outline-success dropdown-toggle" type="button" data-bs-toggle="dropdown">
                Olá, ${nome}
            </button>
            <ul class="dropdown-menu dropdown-menu-end">
                <li><h6 class="dropdown-header">Minha Conta</h6></li>
                <li><a class="dropdown-item" href="#" id="logoutBtn">Sair</a></li>
                <li><hr class="dropdown-divider"></li>
                <li><a class="dropdown-item text-danger fw-bold" href="#" id="deleteAccountBtn">🗑️ Excluir Conta</a></li>
            </ul>
        </div>
    `;

    document.getElementById("logoutBtn").addEventListener("click", () => {
        localStorage.clear();
        window.location.href = loginPath;
    });

    document.getElementById("deleteAccountBtn").addEventListener("click", deletarContaUsuario);
}

async function deletarContaUsuario(e) {
    e.preventDefault();
    if (!confirm("TEM CERTEZA? Isso apagará sua conta e histórico permanentemente.")) return;

    const token = localStorage.getItem("token");
    try {
        const res = await fetch(`${API_URL_BASE}/auth/delete`, {
            method: "DELETE",
            headers: { 
                "Authorization": "Bearer " + token,
                "Content-Type": "application/json" 
            }
        });
        const json = await res.json();

        if (res.ok) {
            alert("Conta excluída. Sentiremos sua falta! 🌸");
            localStorage.clear();
            const homePath = window.location.pathname.includes('/pages/') ? '../home.html' : 'home.html';
            window.location.href = homePath;
        } else {
            alert("Erro: " + (json.erro || json.message));
        }
    } catch (err) {
        console.error(err);
        alert("Erro de conexão.");
    }
}

function searchInPage(searchTerm) {
    if (!searchTerm) return;
    
    document.querySelectorAll('.highlight').forEach(span => {
        const parent = span.parentNode;
        parent.replaceChild(document.createTextNode(span.textContent), span);
        parent.normalize();
    });

    const regex = new RegExp(searchTerm.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'gi');
    const mainContent = document.querySelector('main');
    if (!mainContent) return;

    let found = false;
    
    function traverse(node) {
        if (node.nodeType === 3) {
            if (regex.test(node.nodeValue)) {
                const fragment = document.createDocumentFragment();
                let lastIdx = 0;
                node.nodeValue.replace(regex, (match, offset) => {
                    fragment.appendChild(document.createTextNode(node.nodeValue.substring(lastIdx, offset)));
                    const span = document.createElement('span');
                    span.className = 'highlight';
                    span.textContent = match;
                    fragment.appendChild(span);
                    lastIdx = offset + match.length;
                    found = true;
                });
                fragment.appendChild(document.createTextNode(node.nodeValue.substring(lastIdx)));
                node.parentNode.replaceChild(fragment, node);
            }
        } else if (node.nodeType === 1 && node.tagName !== 'SCRIPT' && node.className !== 'highlight') {
            for (let i = node.childNodes.length - 1; i >= 0; i--) traverse(node.childNodes[i]);
        }
    }
    traverse(mainContent);

    if (found) {
        document.querySelector('.highlight').scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else {
        alert(`Termo "${searchTerm}" não encontrado.`);
    }
}

/* =========================================================================
   INICIALIZAÇÃO (DOMContentLoaded)
   ========================================================================= */
document.addEventListener('DOMContentLoaded', () => {
    // 1. Menu do Usuário
    atualizarMenuUsuario();

    // 2. Carregar Tabela
    const corpoTabela = document.getElementById('corpo-tabela');
    if (corpoTabela) {
        fetch('tabela.json') 
            .then(res => res.json())
            .then(dados => {
                corpoTabela.innerHTML = '';
                dados.forEach(item => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td>${item.nome}</td>
                        <td>${item.definicao}</td>
                        <td>R$ ${parseFloat(item.valor).toFixed(2).replace('.', ',')}</td>
                    `;
                    corpoTabela.appendChild(tr);
                });
            })
            .catch(err => console.error(err));
    }

    // 3. Search Form
    const searchForm = document.getElementById('searchForm');
    if (searchForm) {
        searchForm.addEventListener('submit', (e) => {
            e.preventDefault();
            searchInPage(document.getElementById('searchInput').value.trim());
        });
    }

    // 4. MÁSCARAS (CORRIGIDO AQUI)
    if (typeof $ !== 'undefined' && $.fn.mask) {
        $('#cpf').mask('000.000.000-00');
        
        // CORREÇÃO: Removemos o espaço extra. Agora é (00) 00000-0000
        $('#telefone').mask('(00) 00000-0000');
        $('#celular').mask('(00) 00000-0000');
    }
});