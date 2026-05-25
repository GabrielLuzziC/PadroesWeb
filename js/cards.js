document.addEventListener("DOMContentLoaded", () => {
    carregarFilmes();
});

async function carregarFilmes() {
    try {
        // Caminho relativo à pasta js a partir da pasta pages
        const response = await fetch("../js/filmes.json");
        const filmes = await response.json();
        
        const grid = document.getElementById("catalogo-grid");
        if (grid) {
            filmes.forEach(filme => {
                grid.appendChild(criarCardFilme(filme));
            });
        }
    } catch (error) {
        console.error("Erro ao carregar filmes:", error);
    }
}

function criarCardFilme(filme) {
    const card = document.createElement("div");
    card.className = "filme-card";
    
    // Usa a poster_url do JSON, garantindo um fallback se não houver
    const imageUrl = filme.poster_url || "https://via.placeholder.com/300x450?text=Sem+Poster";
    
    // Criação dos elementos internos do card
    card.innerHTML = `
        <div class="filme-poster-container">
            <img src="${imageUrl}" alt="Pôster do filme ${filme.titulo}" class="filme-poster" loading="lazy">
        </div>
        <div class="filme-info">
            <h3 class="filme-titulo">${filme.titulo}</h3>
            <p class="filme-detalhes">
                <span class="filme-ano">${filme.ano}</span> 
                ${filme.diretor ? `• <span class="filme-diretor">${filme.diretor}</span>` : ""}
            </p>
            <p class="filme-generos">${filme.genero ? filme.genero.join(", ") : ""}</p>
        </div>
    `;
    
    // Adiciona interatividade
    card.addEventListener("click", () => {
        // Exemplo: redirecionar para página de detalhes
        // window.location.href = `detalhes.html?id=${filme.id}`;
        console.log(`Clicou em: ${filme.titulo}`);
    });
    
    return card;
}
