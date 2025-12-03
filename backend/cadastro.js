document.getElementById("cadastroForm").addEventListener("submit", async (e) => {
    e.preventDefault();

    const nome = document.getElementById("nome").value;
    const email = document.getElementById("email").value;
    const senha = document.getElementById("senha").value;

    const resp = await fetch("http://localhost:3000/cadastro", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({ nome, email, senha })
    });

    const data = await resp.json();

    if (resp.ok) {
        alert("Cadastro realizado com sucesso!");
        window.location.href = "login.html"; // redireciona
    } else {
        alert(data.error || "Erro ao cadastrar.");
    }
});
