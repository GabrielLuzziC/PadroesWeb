"use strict";

document.addEventListener("DOMContentLoaded", () => {
    carregarDestaques();
});

async function carregarDestaques() {
    try {
        const response = await fetch("../data/filmes.json");
        const filmes = await response.json();
        
        const containerPrincipal = document.getElementById("destaques-container");
        if (!containerPrincipal) return;

        containerPrincipal.innerHTML = ""; // Limpa o "Carregando..."

        const LIMITE = 20;

        // Categoria 1: Melhores Avaliados
        const melhoresAvaliados = [...filmes]
            .filter(f => f.avaliacao > 0 && f.vote_count >= 50)
            .sort((a, b) => b.avaliacao - a.avaliacao)
            .slice(0, LIMITE);
        if (melhoresAvaliados.length > 0) criarSecaoCarrossel("Aclamados pela Crítica", melhoresAvaliados, containerPrincipal);

        // Categoria 2: Anos 2000
        const anos2000 = filmes
            .filter(f => f.ano >= 2000 && f.ano <= 2009 && f.avaliacao > 0)
            .sort((a, b) => b.avaliacao - a.avaliacao)
            .slice(0, LIMITE);
        if (anos2000.length > 0) criarSecaoCarrossel("Clássicos dos Anos 2000", anos2000, containerPrincipal);

        // Categoria 3: Anos 2010
        const anos2010 = filmes
            .filter(f => f.ano >= 2010 && f.ano <= 2019 && f.avaliacao > 0)
            .sort((a, b) => b.avaliacao - a.avaliacao)
            .slice(0, LIMITE);
        if (anos2010.length > 0) criarSecaoCarrossel("Sucessos da Década de 2010", anos2010, containerPrincipal);

        // Categoria 4: Recentes (2020+)
        const recentes = filmes
            .filter(f => f.ano >= 2020 && f.avaliacao > 0)
            .sort((a, b) => b.avaliacao - a.avaliacao)
            .slice(0, LIMITE);
        if (recentes.length > 0) criarSecaoCarrossel("Lançamentos Recentes", recentes, containerPrincipal);

        // Categoria 5: Comédias
        const comedias = filmes
            .filter(f => f.genero && f.genero.includes("Comédia") && f.avaliacao >= 7)
            .sort((a, b) => b.avaliacao - a.avaliacao)
            .slice(0, LIMITE);
        if (comedias.length > 0) criarSecaoCarrossel("Para dar Boas Risadas", comedias, containerPrincipal);

    } catch (erro) {
        console.error("Erro ao puxar dados dos destaques:", erro);
        document.getElementById("destaques-container").innerHTML = "<p>Ocorreu um erro ao carregar os filmes.</p>";
    }
}

const CARROSSEL_INICIAL = 5; // cards renderizados na abertura
const CARROSSEL_LOTE    = 5; // cards criados a cada clique que se aproxima do fim

function criarSecaoCarrossel(titulo, filmesLista, containerPai) {
    const section = document.createElement("section");
    section.className = "carrossel-section";

    section.innerHTML = `
        <h2>${titulo}</h2>
        <div class="carrossel-container">
            <button class="carrossel-btn left btn-ant">❮</button>
            <div class="carrossel-janela">
                <div class="carrossel-track"></div>
            </div>
            <button class="carrossel-btn right btn-prox">❯</button>
        </div>
    `;

    const track   = section.querySelector(".carrossel-track");
    const btnAnt  = section.querySelector(".btn-ant");
    const btnProx = section.querySelector(".btn-prox");

    // Renderiza o primeiro lote imediatamente
    let renderizados = 0;

    function renderizarLote() {
        const lote = filmesLista.slice(renderizados, renderizados + CARROSSEL_LOTE);
        lote.forEach(filme => {
            const card = criarCardFilme(filme);
            card.classList.add("carrossel-item");
            track.appendChild(card);
        });
        renderizados += lote.length;
    }

    renderizarLote(); // renderiza os primeiros CARROSSEL_INICIAL cards

    containerPai.appendChild(section);

    iniciarDeslize(track, btnAnt, btnProx, filmesLista, renderizarLote, () => renderizados);
}

function iniciarDeslize(track, btnAnt, btnProx, filmesLista, renderizarLote, getRenderizados) {
    let posicaoAtual = 0;

    btnProx.addEventListener("click", () => {
        const totalRendered = track.querySelectorAll(".carrossel-item").length;

        // Se está nos últimos 2 cards e ainda há filmes para renderizar, cria mais
        if (posicaoAtual >= totalRendered - 2 && getRenderizados() < filmesLista.length) {
            renderizarLote();
        }

        const totalItens = track.querySelectorAll(".carrossel-item").length;
        if (posicaoAtual < totalItens - 1) {
            posicaoAtual++;
            movimentarTrack(track, posicaoAtual, true);
        } else {
            // Chegou ao fim: volta ao início sem animar o rebobinar
            posicaoAtual = 0;
            movimentarTrack(track, posicaoAtual, false);
        }
    });

    btnAnt.addEventListener("click", () => {
        const totalItens = track.querySelectorAll(".carrossel-item").length;
        if (posicaoAtual > 0) {
            posicaoAtual--;
            movimentarTrack(track, posicaoAtual, true);
        } else {
            // Está no início: salta para o fim sem animar
            posicaoAtual = totalItens - 1;
            movimentarTrack(track, posicaoAtual, false);
        }
    });
}

function movimentarTrack(track, posicaoAtual, animar) {
    const item = track.querySelector(".carrossel-item");
    if (!item) return;

    const larguraCard = item.offsetWidth + 20;

    if (animar === false) {
        // Desliga a transição, salta, e religa no próximo frame
        track.style.transition = "none";
        track.style.transform = `translateX(-${posicaoAtual * larguraCard}px)`;
        requestAnimationFrame(() => {
            track.style.transition = "";
        });
    } else {
        track.style.transform = `translateX(-${posicaoAtual * larguraCard}px)`;
    }
}

