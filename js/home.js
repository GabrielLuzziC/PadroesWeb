"use strict";

document.addEventListener("DOMContentLoaded", () => {
    carregarContagemAcervo();
});

async function carregarContagemAcervo() {
    const alvo = document.getElementById("acervo-contagem");
    if (!alvo) return;
    try {
        const response = await fetch("../data/filmes.json");
        const filmes = await response.json();
        animarContagem(alvo, filmes.length);
    } catch (erro) {
        console.error("Erro ao carregar contagem do acervo:", erro);
        alvo.textContent = "milhares de";
    }
}

// Anima o número subindo de 0 até o total
function animarContagem(elemento, total) {
    const duracao = 1200;
    const inicio = performance.now();

    function passo(agora) {
        const progresso = Math.min((agora - inicio) / duracao, 1);
        const valor = Math.floor(progresso * total);
        elemento.textContent = valor.toLocaleString("pt-BR");
        if (progresso < 1) {
            requestAnimationFrame(passo);
        }
    }
    requestAnimationFrame(passo);
}
