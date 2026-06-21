"use strict";

document.addEventListener("DOMContentLoaded", () => {
    carregarDetalhesFilme();
});

async function carregarDetalhesFilme() {
    // Pegar o ID do filme da URL ex: detalhes.html?id=a-aventura-mistica-de-gi-x
    const urlParams = new URLSearchParams(window.location.search);
    const filmeId = urlParams.get("id");

    if (!filmeId) {
        exibirErro("Nenhum filme especificado na URL.");
        return;
    }

    try {
        const response = await fetch("../data/filmes.json");
        const filmes = await response.json();
        
        // Busca o filme pelo ID
        const filme = filmes.find(f => f.id === filmeId);

        if (!filme) {
            exibirErro("Filme não encontrado.");
            return;
        }

        preencherPagina(filme);
    } catch (error) {
        console.error("Erro ao carregar detalhes do filme:", error);
        exibirErro("Erro ao carregar os dados do filme.");
    }
}

function preencherPagina(filme) {
    document.title = `${filme.titulo} - Cine Brasilis`;

    // Textos simples
    document.getElementById("titulo").textContent        = filme.titulo        || "Título indisponível";
    document.getElementById("ano").textContent           = filme.ano           || "";
    document.getElementById("diretor").textContent       = filme.diretor       || "Não informado";
    document.getElementById("produtora").textContent     = filme.produtora     || "Não informada";
    document.getElementById("regiao").textContent        = filme.regiao        || "Não informada";
    document.getElementById("estado").textContent        = filme.estado        || "Não informado";
    document.getElementById("sinopse").textContent       = filme.sinopse       || "Sem sinopse no momento.";
    document.getElementById("data-lancamento").textContent = filme.data_lancamento
        ? new Date(filme.data_lancamento).toLocaleDateString("pt-BR") : "Não informado";

    // Duração
    const duracaoEl = document.getElementById("duracao");
    if (duracaoEl) {
        duracaoEl.textContent = filme.duracao ? `${filme.duracao} min` : "";
    }

    // Classificação indicativa
    const classEl = document.getElementById("classificacao");
    if (classEl) {
        classEl.textContent = filme.classificacao || "";
    }

    // Avaliação + contagem de votos
    const avaliacaoEl = document.getElementById("avaliacao");
    if (avaliacaoEl) {
        avaliacaoEl.textContent = filme.avaliacao ? `★ ${filme.avaliacao}/10` : "Sem avaliação";
    }
    const voteEl = document.getElementById("vote-count");
    if (voteEl) {
        voteEl.textContent = filme.vote_count ? `(${filme.vote_count.toLocaleString("pt-BR")} votos)` : "";
    }

    // Link IMDB
    const imdbRow  = document.getElementById("imdb-row");
    const imdbLink = document.getElementById("imdb-link");
    if (imdbRow && imdbLink) {
        if (filme.imdb_id) {
            imdbLink.href = `https://www.imdb.com/title/${filme.imdb_id}/`;
            imdbLink.innerHTML = `<img src="https://upload.wikimedia.org/wikipedia/commons/6/69/IMDB_Logo_2016.svg" alt="Ver no IMDB" class="imdb-logo">`;
            imdbRow.style.display = "";
        } else {
            imdbRow.style.display = "none";
        }
    }

    // Poster
    const posterEl = document.getElementById("poster");
    if (posterEl) {
        posterEl.src    = filme.poster_url || "../img/sem-poster.svg";
        posterEl.alt    = `Pôster do filme ${filme.titulo}`;
        posterEl.onerror = function () { this.onerror = null; this.src = "../img/sem-poster.svg"; };
    }

    // Backdrop como banner acima do conteúdo
    const backdropEl = document.getElementById("backdrop-banner");
    if (backdropEl) {
        if (filme.backdrop_url) {
            backdropEl.style.backgroundImage = `url('${filme.backdrop_url}')`;
            backdropEl.style.display = "block";
            backdropEl.style.cursor = "zoom-in";
            backdropEl.addEventListener("click", () => abrirLightbox(filme.backdrop_url));
        } else {
            backdropEl.style.display = "none";
        }
    }

    // Listas
    preencherLista("genero",  filme.genero);
    preencherLista("elenco",  filme.elenco);
    preencherLista("premios", filme.premios);
    preencherTags(filme.tags);

    // Trailer
    const trailerEl = document.getElementById("trailer");
    if (trailerEl) {
        if (filme.trailer) {
            let linkEmbed = filme.trailer;
            if (linkEmbed.includes("watch?v=")) {
                linkEmbed = linkEmbed.replace("watch?v=", "embed/");
            }
            trailerEl.src = linkEmbed;
            trailerEl.closest(".filme-secao").style.display = "block";
        } else {
            trailerEl.closest(".filme-secao").style.display = "none";
        }
    }
}

function abrirLightbox(url) {
    const lightbox = document.getElementById("lightbox");
    const img      = document.getElementById("lightbox-img");
    img.src        = url;
    lightbox.classList.add("lightbox--ativo");
}

function fecharLightbox() {
    const lightbox = document.getElementById("lightbox");
    lightbox.classList.remove("lightbox--ativo");
}

document.addEventListener("DOMContentLoaded", () => {
    const lightbox = document.getElementById("lightbox");
    if (lightbox) {
        lightbox.addEventListener("click", fecharLightbox);
    }
    document.addEventListener("keydown", e => {
        if (e.key === "Escape") fecharLightbox();
    });
});

function preencherTags(tags) {
    const container = document.getElementById("tags");
    if (!container) return;
    container.innerHTML = "";
    if (tags && tags.length > 0) {
        tags.forEach(tag => {
            const span = document.createElement("span");
            span.className = "tag-chip";
            span.textContent = tag;
            container.appendChild(span);
        });
    } else {
        container.innerHTML = "<span class='detalhe-vazio'>Sem tags</span>";
    }
}

// Função auxiliar para preencher ULs com LIs
function preencherLista(elementoId, arrayDeItems) {
    const lista = document.getElementById(elementoId);
    if (!lista) return;

    lista.innerHTML = ""; // Limpa itens antigos
    
    if (arrayDeItems && arrayDeItems.length > 0) {
        arrayDeItems.forEach(item => {
            const li = document.createElement("li");
            li.textContent = item;
            lista.appendChild(li);
        });
    } else {
        const li = document.createElement("li");
        li.textContent = "Informação não disponível";
        lista.appendChild(li);
    }
}

function exibirErro(mensagem) {
    const container = document.querySelector(".detalhes-container");
    if (container) {
        container.innerHTML = `<h2>Oops!</h2><p>${mensagem}</p><a href="catalogo.html">Voltar ao catálogo</a>`;
    }
}