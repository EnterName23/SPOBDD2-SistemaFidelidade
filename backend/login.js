document.getElementById("formLogin").addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = document.getElementById("email").value;
    const senha = document.getElementById("senha").value;

    const msg = document.getElementById("msg");
    msg.textContent = "Processando...";

    try {
        const response = await fetch("http://localhost:3000/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, senha })
        });

        const data = await response.json();

        if (!response.ok) {
            msg.textContent = data.erro || "Erro no login.";
            msg.style.color = "red";
            return;
        }

        localStorage.setItem("token", data.token);
        localStorage.setItem("nome", data.nome);

        msg.textContent = "Login realizado!";
        msg.style.color = "green";

        setTimeout(() => {
            window.location.href = "../home.html";
        }, 800);

    } catch (err) {
        msg.textContent = "Erro de conexão com o servidor.";
        msg.style.color = "red";
    }
});
