"use strict";

document.addEventListener("DOMContentLoaded", () => {
    carregarFilmes();
});

let todosFilmes = [];
let filmesFiltrados = [];
let todosAtores = [];
let paginaAtual = 1;
const filmesPorPagina = 12;

// ---------------------------------------------------------------------------
// Carregamento
// ---------------------------------------------------------------------------

async function carregarFilmes() {
    try {
        const response = await fetch("../data/filmes.json");
        todosFilmes = await response.json();
        filmesFiltrados = todosFilmes;
        todosAtores = [...new Set(todosFilmes.flatMap(f => f.elenco || []))].sort();

        popularFiltroGeneros();
        popularFiltroEstados();
        renderizarPagina(paginaAtual);
        configurarFiltros();
    } catch (error) {
        console.error("Erro ao carregar filmes:", error);
    }
}

// ---------------------------------------------------------------------------
// Filtros
// ---------------------------------------------------------------------------

function popularFiltroGeneros() {
    const generosUnicos = [...new Set(
        todosFilmes.flatMap(f => f.genero || [])
    )].sort();

    const select = document.getElementById("filtro-genero");
    generosUnicos.forEach(genero => {
        const option = document.createElement("option");
        option.value = genero;
        option.textContent = genero;
        select.appendChild(option);
    });
}

function popularFiltroEstados() {
    const estadosUnicos = [...new Set(
        todosFilmes.map(f => f.estado).filter(Boolean)
    )].sort();

    const select = document.getElementById("filtro-estado");
    estadosUnicos.forEach(estado => {
        const option = document.createElement("option");
        option.value = estado;
        option.textContent = estado;
        select.appendChild(option);
    });
}

// Remove acentos de uma string (NFD + corte das marcas diacríticas)
function semAcento(texto) {
    return texto.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function aplicarFiltros() {
    const busca    = document.getElementById("filtro-busca").value.toLowerCase().trim();
    const genero   = document.getElementById("filtro-genero").value;
    const decada   = document.getElementById("filtro-decada").value;
    const metragem = document.getElementById("filtro-metragem").value;
    const estado   = document.getElementById("filtro-estado").value;
    const diretor  = document.getElementById("filtro-diretor").value.toLowerCase().trim();
    const atores   = document.getElementById("filtro-ator").value
        .split(",")
        .map(a => a.trim().toLowerCase())
        .filter(a => a.length > 0);

    // Acento assimétrico: busca SEM acento ignora acentos do título ("pao" acha "Pão");
    // busca COM acento é exata ("pão" não acha "Pao").
    const buscaTemAcento = busca !== semAcento(busca);

    filmesFiltrados = todosFilmes.filter(filme => {
        let casaBusca = !busca;
        if (busca) {
            const titulo = filme.titulo.toLowerCase();
            casaBusca = buscaTemAcento
                ? titulo.includes(busca)
                : semAcento(titulo).includes(busca);
        }
        const casaGenero   = !genero   || (filme.genero && filme.genero.includes(genero));
        const casaDecada   = !decada   || (filme.ano && Math.floor(filme.ano / 10) * 10 === Number(decada));
        const casaMetragem = !metragem || filme.metragem === metragem;
        const casaEstado   = !estado   || filme.estado === estado;
        const casaDiretor  = !diretor  || (filme.diretor && filme.diretor.toLowerCase().includes(diretor));
        const casaAtores   = atores.length === 0 || atores.every(ator =>
            filme.elenco && filme.elenco.some(e => e.toLowerCase().includes(ator))
        );
        return casaBusca && casaGenero && casaDecada && casaMetragem && casaEstado && casaDiretor && casaAtores;
    });

    paginaAtual = 1;
    atualizarContagem();
    renderizarPagina(paginaAtual);
}

function debounce(fn, delay) {
    let timer;
    return function (...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), delay);
    };
}

function configurarFiltros() {
    document.getElementById("filtro-busca").addEventListener("input", debounce(aplicarFiltros, 300));
    document.getElementById("filtro-genero").addEventListener("change", aplicarFiltros);
    document.getElementById("filtro-decada").addEventListener("change", aplicarFiltros);
    document.getElementById("filtro-metragem").addEventListener("change", aplicarFiltros);
    document.getElementById("filtro-estado").addEventListener("change", aplicarFiltros);
    document.getElementById("filtro-diretor").addEventListener("input", debounce(aplicarFiltros, 300));
    document.getElementById("filtro-ator").addEventListener("input", debounce(() => {
        mostrarSugestoes();
        aplicarFiltros();
    }, 300));

    document.getElementById("filtro-ator").addEventListener("blur", () => {
        setTimeout(() => fecharSugestoes(), 150);
    });

    // Botão que abre/fecha o painel de filtros
    document.getElementById("btn-filtros").addEventListener("click", () => {
        const painel = document.getElementById("filtros-painel");
        const botao  = document.getElementById("btn-filtros");
        const aberto = !painel.hidden;
        painel.hidden = aberto;
        botao.setAttribute("aria-expanded", String(!aberto));
        botao.classList.toggle("ativo", !aberto);
    });

    document.getElementById("filtro-limpar").addEventListener("click", () => {
        document.getElementById("filtro-busca").value = "";
        document.getElementById("filtro-genero").value = "";
        document.getElementById("filtro-decada").value = "";
        document.getElementById("filtro-metragem").value = "";
        document.getElementById("filtro-estado").value = "";
        document.getElementById("filtro-diretor").value = "";
        document.getElementById("filtro-ator").value = "";
        filmesFiltrados = todosFilmes;
        paginaAtual = 1;
        atualizarContagem();
        renderizarPagina(paginaAtual);
    });

    atualizarContagem();
}

// ---------------------------------------------------------------------------
// Autocomplete de atores
// ---------------------------------------------------------------------------

function mostrarSugestoes() {
    const input    = document.getElementById("filtro-ator");
    const lista    = document.getElementById("ator-sugestoes");
    const valorTotal = input.value;

    // Pega o último segmento após a última vírgula
    const partes   = valorTotal.split(",");
    const termo    = partes[partes.length - 1].trim().toLowerCase();

    lista.innerHTML = "";

    if (termo.length < 2) {
        fecharSugestoes();
        return;
    }

    const matches = todosAtores
        .filter(a => a.toLowerCase().includes(termo))
        .slice(0, 8);

    if (matches.length === 0) {
        fecharSugestoes();
        return;
    }

    matches.forEach(ator => {
        const li = document.createElement("li");
        li.className = "sugestao-item";
        li.textContent = ator;
        li.addEventListener("mousedown", () => {
            // Substitui o último segmento pelo nome completo selecionado
            partes[partes.length - 1] = " " + ator;
            input.value = partes.join(",").replace(/^,\s*/, "");
            fecharSugestoes();
            aplicarFiltros();
        });
        lista.appendChild(li);
    });

    lista.style.display = "block";
}

function fecharSugestoes() {
    const lista = document.getElementById("ator-sugestoes");
    lista.style.display = "none";
    lista.innerHTML = "";
}

function atualizarContagem() {
    const el = document.getElementById("catalogo-contagem");
    if (!el) return;
    const total = filmesFiltrados.length;
    el.textContent = total === todosFilmes.length
        ? `${total.toLocaleString("pt-BR")} filmes`
        : `${total.toLocaleString("pt-BR")} filmes encontrados`;
}

// ---------------------------------------------------------------------------
// Renderização
// ---------------------------------------------------------------------------

function renderizarPagina(pagina) {
    const grid = document.getElementById("catalogo-grid");
    if (!grid) return;

    grid.innerHTML = "";

    const indexInicio = (pagina - 1) * filmesPorPagina;
    const indexFim    = indexInicio + filmesPorPagina;

    const filmesDaPagina = filmesFiltrados.slice(indexInicio, indexFim);

    if (filmesDaPagina.length === 0) {
        grid.innerHTML = "<p class='catalogo-vazio'>Nenhum filme encontrado para os filtros selecionados.</p>";
        document.getElementById("paginacao-container").innerHTML = "";
        return;
    }

    filmesDaPagina.forEach(filme => {
        grid.appendChild(criarCardFilme(filme));
    });

    renderizarControlesPaginacao();
}

function renderizarControlesPaginacao() {
    const container = document.getElementById("paginacao-container");
    if (!container) return;

    container.innerHTML = "";

    const totalPaginas = Math.ceil(filmesFiltrados.length / filmesPorPagina);
    if (totalPaginas <= 1) return;

    const btnAnterior = document.createElement("button");
    btnAnterior.textContent = "❮ Anterior";
    btnAnterior.className = "btn-paginacao";
    btnAnterior.disabled = paginaAtual === 1;
    btnAnterior.addEventListener("click", () => {
        if (paginaAtual > 1) {
            paginaAtual--;
            renderizarPagina(paginaAtual);
            window.scrollTo({ top: 0, behavior: "smooth" });
        }
    });

    const textoPagina = document.createElement("span");
    textoPagina.className = "texto-paginacao";
    textoPagina.textContent = `Página ${paginaAtual} de ${totalPaginas}`;

    const btnProximo = document.createElement("button");
    btnProximo.textContent = "Próxima ❯";
    btnProximo.className = "btn-paginacao";
    btnProximo.disabled = paginaAtual === totalPaginas;
    btnProximo.addEventListener("click", () => {
        if (paginaAtual < totalPaginas) {
            paginaAtual++;
            renderizarPagina(paginaAtual);
            window.scrollTo({ top: 0, behavior: "smooth" });
        }
    });

    container.appendChild(btnAnterior);
    container.appendChild(textoPagina);
    container.appendChild(btnProximo);
}
