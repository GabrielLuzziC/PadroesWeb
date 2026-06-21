"use strict";

// Pool de filmes brasileiros famosos usados como "âncoras" de preferência.
// (Placeholder até existir um subcatálogo internacional dedicado.)
const POOL_IDS = [
    "ainda-estou-aqui", "cidade-de-deus", "o-auto-da-compadecida", "central-do-brasil",
    "tropa-de-elite", "tropa-de-elite-2-o-inimigo-agora-e-outro", "que-horas-ela-volta",
    "bacurau", "aquarius", "o-som-ao-redor", "cidade-baixa", "carandiru",
    "o-pagador-de-promessas", "deus-e-o-diabo-na-terra-do-sol", "macunaima",
    "pixote-a-lei-do-mais-fraco", "lavoura-arcaica", "o-palhaco", "se-eu-fosse-voce",
    "o-homem-que-copiava", "lisbela-e-o-prisioneiro", "caramuru-a-invencao-do-brasil",
    "o-cheiro-do-ralo", "meu-nome-nao-e-johnny", "marighella", "a-vida-invisivel",
    "democracia-em-vertigem", "o-menino-e-o-mundo", "bingo-o-rei-das-manhas",
    "dona-flor-e-seus-dois-maridos", "eu-tu-eles", "o-quatrilho", "olga",
    "estomago", "divinas-divas"
];

const MAX_SELECAO = 5;
const PESO_TAG    = 3;
const PESO_GENERO = 2;
const PESO_DECADA = 1;

let todosFilmes   = [];
let poolFilmes    = [];
let selecionados  = new Set();   // ids selecionados
const idsPool     = new Set(POOL_IDS);

document.addEventListener("DOMContentLoaded", () => {
    iniciar();
});

async function iniciar() {
    try {
        const response = await fetch("../data/filmes.json");
        todosFilmes = await response.json();

        const porId = new Map(todosFilmes.map(f => [f.id, f]));
        poolFilmes = POOL_IDS.map(id => porId.get(id)).filter(Boolean);

        renderizarPool();
        atualizarBarra();

        document.getElementById("btn-recomendar").addEventListener("click", gerarRecomendacoes);
        document.getElementById("btn-limpar-selecao").addEventListener("click", limparSelecao);
    } catch (erro) {
        console.error("Erro ao carregar filmes:", erro);
    }
}

// ---------------------------------------------------------------------------
// Seleção
// ---------------------------------------------------------------------------

function renderizarPool() {
    const grid = document.getElementById("pool-grid");
    grid.innerHTML = "";

    poolFilmes.forEach(filme => {
        const tile = document.createElement("div");
        tile.className = "selecao-tile";
        tile.dataset.id = filme.id;

        const poster = filme.poster_url || "../img/sem-poster.svg";
        tile.innerHTML = `
            <div class="selecao-poster">
                <img src="${poster}" alt="${filme.titulo}" loading="lazy"
                     onerror="this.onerror=null;this.src='../img/sem-poster.svg';">
                <span class="selecao-check">✓</span>
            </div>
            <p class="selecao-titulo">${filme.titulo}</p>
        `;

        tile.addEventListener("click", () => alternarSelecao(filme.id, tile));
        grid.appendChild(tile);
    });
}

function alternarSelecao(id, tile) {
    if (selecionados.has(id)) {
        selecionados.delete(id);
        tile.classList.remove("selecionado");
    } else {
        if (selecionados.size >= MAX_SELECAO) return; // limite atingido
        selecionados.add(id);
        tile.classList.add("selecionado");
    }
    atualizarBarra();
}

function atualizarBarra() {
    const contador = document.getElementById("selecao-contador");
    const botao    = document.getElementById("btn-recomendar");
    contador.textContent = `${selecionados.size} / ${MAX_SELECAO} selecionados`;
    botao.disabled = selecionados.size === 0;

    // Esmaece tiles não selecionados quando o limite é atingido
    const limiteAtingido = selecionados.size >= MAX_SELECAO;
    document.querySelectorAll(".selecao-tile").forEach(t => {
        const cheio = limiteAtingido && !t.classList.contains("selecionado");
        t.classList.toggle("desabilitado", cheio);
    });
}

function limparSelecao() {
    selecionados.clear();
    document.querySelectorAll(".selecao-tile").forEach(t =>
        t.classList.remove("selecionado", "desabilitado")
    );
    atualizarBarra();
    document.getElementById("resultados-bloco").style.display = "none";
}

// ---------------------------------------------------------------------------
// Algoritmo de recomendação
// ---------------------------------------------------------------------------

function decada(ano) {
    return ano ? Math.floor(ano / 10) * 10 : null;
}

function intersecao(a, b) {
    if (!a || !b) return 0;
    const setB = new Set(b);
    return a.reduce((n, item) => n + (setB.has(item) ? 1 : 0), 0);
}

function pontuar(candidato, referencias) {
    let score = 0;
    referencias.forEach(ref => {
        score += PESO_TAG    * intersecao(candidato.tags, ref.tags);
        score += PESO_GENERO * intersecao(candidato.genero, ref.genero);
        if (decada(candidato.ano) !== null && decada(candidato.ano) === decada(ref.ano)) {
            score += PESO_DECADA;
        }
    });
    return score;
}

function gerarRecomendacoes() {
    const referencias = todosFilmes.filter(f => selecionados.has(f.id));

    const candidatos = todosFilmes.filter(f =>
        !idsPool.has(f.id) &&            // não recomenda os próprios filmes do pool
        f.poster_url &&                  // garante card com poster
        f.avaliacao > 0 &&
        (f.vote_count || 0) >= 20        // evita filmes com avaliação irrelevante
    );

    const ranqueados = candidatos
        .map(f => ({ filme: f, score: pontuar(f, referencias) }))
        .filter(item => item.score > 0)
        .sort((a, b) =>
            b.score - a.score || (b.filme.avaliacao || 0) - (a.filme.avaliacao || 0)
        )
        .slice(0, 12);

    renderizarResultados(ranqueados);
}

function renderizarResultados(ranqueados) {
    const bloco = document.getElementById("resultados-bloco");
    const grid  = document.getElementById("resultados-grid");
    grid.innerHTML = "";

    if (ranqueados.length === 0) {
        grid.innerHTML = "<p class='resultados-vazio'>Não encontramos produções semelhantes o suficiente. Tente outras combinações.</p>";
    } else {
        ranqueados.forEach(item => grid.appendChild(criarCardFilme(item.filme)));
    }

    bloco.style.display = "block";
    bloco.scrollIntoView({ behavior: "smooth", block: "start" });
}
