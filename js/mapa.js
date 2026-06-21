"use strict";

let filmesPorEstado = {};

const SVG_NS = "http://www.w3.org/2000/svg";

// Estados pequenos demais para caber o rótulo dentro: recebem rótulo externo + linha
const ESTADOS_EXTERNOS = new Set(["RJ", "ES", "AL", "SE", "PB", "RN", "PE", "DF"]);
const COLUNA_EXTERNA_X = 945;   // x da coluna de rótulos externos (viewBox 0..1000)

document.addEventListener("DOMContentLoaded", () => {
    inicializarMapa();
});

async function inicializarMapa() {
    try {
        const response = await fetch("../data/filmes.json");
        const filmes = await response.json();
        indexarPorEstado(filmes);
        configurarEstados();
        criarRotulos();
        mostrarEstadoInicial();
    } catch (erro) {
        console.error("Erro ao carregar dados do mapa:", erro);
    }
}

function indexarPorEstado(filmes) {
    filmesPorEstado = {};
    filmes.forEach(filme => {
        if (filme.estado) {
            (filmesPorEstado[filme.estado] ||= []).push(filme);
        }
    });
    Object.values(filmesPorEstado).forEach(lista =>
        lista.sort((a, b) => (b.avaliacao || 0) - (a.avaliacao || 0))
    );
}

function pathsDosEstados() {
    return [...document.querySelectorAll('#mapa-brasil-container path[id^="BR"]')]
        .filter(p => p.id.length === 4);
}

function configurarEstados() {
    const containerInfo = document.getElementById("info-estado-container");
    const estados = pathsDosEstados();

    estados.forEach(path => {
        path.classList.add("estado");
        path.addEventListener("click", () => selecionarEstado(path, estados, containerInfo));
    });
}

function selecionarEstado(path, estados, containerInfo) {
    estados.forEach(e => {
        e.classList.remove("ativo");
        const lbl = e.rotulo;
        if (lbl) lbl.forEach(el => el.classList.remove("rotulo-ativo"));
    });
    path.classList.add("ativo");
    if (path.rotulo) path.rotulo.forEach(el => el.classList.add("rotulo-ativo"));

    const uf   = path.id.slice(2);
    const nome = path.getAttribute("data-name") || uf;
    gerarPainelEstado(uf, nome, containerInfo);
}

// ---------------------------------------------------------------------------
// Rótulos (siglas) sobre o mapa
// ---------------------------------------------------------------------------

function criarRotulos() {
    const svg = document.querySelector("#mapa-brasil-container svg");
    if (!svg) return;
    const estados = pathsDosEstados();
    const containerInfo = document.getElementById("info-estado-container");

    // Estados com rótulo externo, ordenados verticalmente para distribuir a coluna
    const externos = estados
        .filter(p => ESTADOS_EXTERNOS.has(p.id.slice(2)))
        .map(p => ({ path: p, bbox: p.getBBox() }))
        .sort((a, b) => (a.bbox.y + a.bbox.height / 2) - (b.bbox.y + b.bbox.height / 2));

    // Distribui as posições verticais dos rótulos externos
    const topo = 120, base = 800;
    const passo = externos.length > 1 ? (base - topo) / (externos.length - 1) : 0;

    estados.forEach(path => {
        const uf = path.id.slice(2);
        const bbox = path.getBBox();
        const cx = bbox.x + bbox.width / 2;
        const cy = bbox.y + bbox.height / 2;

        if (ESTADOS_EXTERNOS.has(uf)) {
            const idx = externos.findIndex(e => e.path === path);
            const labelY = topo + passo * idx;
            criarRotuloExterno(svg, path, uf, cx, cy, labelY, estados, containerInfo);
        } else {
            const texto = criarTexto(uf, cx, cy, "rotulo-uf rotulo-interno");
            svg.appendChild(texto);
            path.rotulo = [texto];
            vincularHover(path);
        }
    });
}

function criarTexto(uf, x, y, classe) {
    const texto = document.createElementNS(SVG_NS, "text");
    texto.setAttribute("x", x);
    texto.setAttribute("y", y);
    texto.setAttribute("class", classe);
    texto.textContent = uf;
    return texto;
}

function criarRotuloExterno(svg, path, uf, cx, cy, labelY, estados, containerInfo) {
    // Linha do centro do estado até a coluna de rótulos
    const linha = document.createElementNS(SVG_NS, "line");
    linha.setAttribute("x1", cx);
    linha.setAttribute("y1", cy);
    linha.setAttribute("x2", COLUNA_EXTERNA_X - 6);
    linha.setAttribute("y2", labelY);
    linha.setAttribute("class", "rotulo-linha");

    const texto = criarTexto(uf, COLUNA_EXTERNA_X, labelY + 5, "rotulo-uf rotulo-externo");

    svg.appendChild(linha);
    svg.appendChild(texto);

    path.rotulo = [texto, linha];
    vincularHover(path);

    // Hover/clique também a partir do rótulo externo e da linha
    [texto, linha].forEach(el => {
        el.addEventListener("mouseenter", () => realcar(path, true));
        el.addEventListener("mouseleave", () => realcar(path, false));
        el.addEventListener("click", () => selecionarEstado(path, estados, containerInfo));
    });
}

function vincularHover(path) {
    path.addEventListener("mouseenter", () => realcar(path, true));
    path.addEventListener("mouseleave", () => realcar(path, false));
}

function realcar(path, ativo) {
    path.classList.toggle("estado-hover", ativo);
    if (path.rotulo) {
        path.rotulo.forEach(el => el.classList.toggle("rotulo-hover", ativo));
    }
}

// ---------------------------------------------------------------------------
// Painel lateral
// ---------------------------------------------------------------------------

function gerarPainelEstado(uf, nome, container) {
    const filmes = filmesPorEstado[uf] || [];
    container.classList.add("visivel");

    // Resumo compacto no painel lateral
    if (filmes.length === 0) {
        container.innerHTML = `
            <div class="aviso-card">
                <h3>${nome} <span class="painel-uf">${uf}</span></h3>
                <p>Nenhuma produção catalogada para este estado ainda.</p>
            </div>
        `;
        ocultarCarrosselEstado();
        return;
    }

    container.innerHTML = `
        <div class="painel-estado-header">
            <h3>${nome} <span class="painel-uf">${uf}</span></h3>
            <p class="painel-contagem">${filmes.length} ${filmes.length === 1 ? "produção catalogada" : "produções catalogadas"}</p>
            <p class="painel-dica">Veja os filmes no carrossel abaixo do mapa.</p>
        </div>
    `;

    renderizarCarrosselEstado(nome, filmes);
}

// ---------------------------------------------------------------------------
// Carrossel de filmes do estado (abaixo do mapa)
// ---------------------------------------------------------------------------

function renderizarCarrosselEstado(nome, filmes) {
    const bloco  = document.getElementById("filmes-estado-bloco");
    const titulo = document.getElementById("filmes-estado-titulo");
    const track  = document.getElementById("estado-track");
    if (!bloco || !track) return;

    const LIMITE = 30;
    titulo.textContent = `Produções de ${nome}`;
    track.innerHTML = "";

    filmes.slice(0, LIMITE).forEach(filme => {
        const card = criarCardFilme(filme);
        card.classList.add("carrossel-item");
        track.appendChild(card);
    });

    bloco.style.display = "block";
    iniciarDeslizeEstado(track);
    bloco.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function ocultarCarrosselEstado() {
    const bloco = document.getElementById("filmes-estado-bloco");
    if (bloco) bloco.style.display = "none";
}

// Reinicia os listeners do carrossel do zero a cada estado selecionado
function iniciarDeslizeEstado(track) {
    const btnAnt  = document.getElementById("estado-btn-ant");
    const btnProx = document.getElementById("estado-btn-prox");

    // Clona os botões para descartar listeners de seleções anteriores
    const novoAnt  = btnAnt.cloneNode(true);
    const novoProx = btnProx.cloneNode(true);
    btnAnt.replaceWith(novoAnt);
    btnProx.replaceWith(novoProx);

    let posicao = 0;

    novoProx.addEventListener("click", () => {
        const total = track.querySelectorAll(".carrossel-item").length;
        if (posicao < total - 1) {
            posicao++;
            moverTrack(track, posicao, true);
        } else {
            posicao = 0;
            moverTrack(track, posicao, false); // volta ao início sem animar
        }
    });

    novoAnt.addEventListener("click", () => {
        const total = track.querySelectorAll(".carrossel-item").length;
        if (posicao > 0) {
            posicao--;
            moverTrack(track, posicao, true);
        } else {
            posicao = total - 1;
            moverTrack(track, posicao, false);
        }
    });
}

function moverTrack(track, posicao, animar) {
    const item = track.querySelector(".carrossel-item");
    if (!item) return;
    const largura = item.offsetWidth + 20;

    if (animar === false) {
        track.style.transition = "none";
        track.style.transform = `translateX(-${posicao * largura}px)`;
        requestAnimationFrame(() => { track.style.transition = ""; });
    } else {
        track.style.transform = `translateX(-${posicao * largura}px)`;
    }
}

function mostrarEstadoInicial() {
    const container = document.getElementById("info-estado-container");
    container.innerHTML = `
        <div class="aviso-card">
            <h3>Explore o cinema por estado</h3>
            <p>Clique em um estado no mapa para ver as produções daquela região.</p>
        </div>
    `;
    container.classList.add("visivel");
    ocultarCarrosselEstado();
}
