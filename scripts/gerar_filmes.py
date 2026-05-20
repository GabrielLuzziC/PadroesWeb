"""
gerar_filmes.py
Extrai TODOS os filmes brasileiros do TMDB (sem limite de 10.000)
e gera js/filmes.json + scripts/filmes.xlsx.

Fluxo em duas fases independentes:

  FASE 1 — Coleta de IDs
    Pagina o /discover mês a mês (1945 → hoje) e salva todos os IDs
    únicos em ids_coletados.json. Se esse arquivo já existir, a fase 1
    é pulada completamente.

  FASE 2 — Detalhes por filme
    Lê ids_coletados.json, processa em lotes de 50 e grava cada lote
    no filmes_parcial.jsonl. O checkpoint registra quantos IDs já foram
    processados. Se interrompido, retoma do último lote completo.
    Ao terminar, converte para filmes.json e filmes.xlsx.

Uso:
    cd scripts/
    pip install -r requirements.txt
    python gerar_filmes.py

Variáveis de ambiente (.env):
    TMDB_TOKEN=seu_bearer_token_aqui
    TMDB_API_KEY=sua_api_key_aqui   (reserva, opcional)
"""

import os
import json
import time
import re
import sys
import calendar
from datetime import date
import requests
from dotenv import load_dotenv
import pandas as pd
from unidecode import unidecode

# ---------------------------------------------------------------------------
# Configuração
# ---------------------------------------------------------------------------

load_dotenv()

TOKEN   = os.getenv("TMDB_TOKEN")
API_KEY = os.getenv("TMDB_API_KEY")

if not TOKEN and not API_KEY:
    print("Erro: defina TMDB_TOKEN (e/ou TMDB_API_KEY) no arquivo .env")
    sys.exit(1)

BASE_URL    = "https://api.themoviedb.org/3"
POSTER_BASE = "https://image.tmdb.org/t/p"

HEADERS = {"accept": "application/json"}
if TOKEN:
    HEADERS["Authorization"] = f"Bearer {TOKEN}"

SCRIPT_DIR   = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)

# Saídas finais
JSON_OUT  = os.path.join(PROJECT_ROOT, "js", "filmes.json")
EXCEL_OUT = os.path.join(SCRIPT_DIR, "filmes.xlsx")

# Arquivos de progresso
IDS_FILE      = os.path.join(SCRIPT_DIR, "ids_coletados.json")   # fase 1 — permanente até extração completa
JSONL_PARCIAL = os.path.join(SCRIPT_DIR, "filmes_parcial.jsonl") # fase 2 — filmes processados
CHECKPOINT    = os.path.join(SCRIPT_DIR, ".checkpoint.json")     # fase 2 — quantos IDs já processados

ANO_INICIO   = 1945
ANO_FIM      = date.today().year
RATE_DELAY   = 0.27
ELENCO_LIMIT = 10
LOTE         = 50   # filmes gravados por vez no .jsonl

# ---------------------------------------------------------------------------
# HTTP
# ---------------------------------------------------------------------------

def requisicao(url, params=None, tentativas=4):
    if not TOKEN and API_KEY:
        params = params or {}
        params["api_key"] = API_KEY

    for tentativa in range(1, tentativas + 1):
        try:
            r = requests.get(url, headers=HEADERS, params=params, timeout=15)
            if r.status_code == 429:
                espera = int(r.headers.get("Retry-After", 10))
                print(f"\n  [Rate limit] Aguardando {espera}s...")
                time.sleep(espera)
                continue
            if r.status_code == 200:
                return r.json()
            print(f"\n  [HTTP {r.status_code}] {url} (tentativa {tentativa}/{tentativas})")
        except requests.RequestException as e:
            print(f"\n  [Erro de rede] {e} (tentativa {tentativa}/{tentativas})")
        time.sleep(2 ** tentativa)
    return None

# ---------------------------------------------------------------------------
# FASE 1 — Coleta de IDs
# ---------------------------------------------------------------------------

def fatias_mensais(ano_inicio, ano_fim):
    fatias = []
    for ano in range(ano_inicio, ano_fim + 1):
        for mes in range(1, 13):
            ultimo_dia = calendar.monthrange(ano, mes)[1]
            fatias.append((
                f"{ano}-{mes:02d}-01",
                f"{ano}-{mes:02d}-{ultimo_dia:02d}"
            ))
    return fatias


def buscar_ids_por_intervalo(data_inicio, data_fim):
    ids = []
    pagina = 1
    total_paginas = 1

    while pagina <= total_paginas:
        params = {
            "with_origin_country": "BR",
            "primary_release_date.gte": data_inicio,
            "primary_release_date.lte": data_fim,
            "sort_by": "popularity.desc",
            "page": pagina,
        }
        dados = requisicao(f"{BASE_URL}/discover/movie", params=params)
        if not dados:
            break

        total_paginas = min(dados.get("total_pages", 1), 500)
        ids.extend(r["id"] for r in dados.get("results", []))

        if total_paginas == 500 and pagina == 1:
            print(f"\n  [Aviso] {data_inicio}→{data_fim} atingiu 500 páginas.")

        pagina += 1
        time.sleep(RATE_DELAY)

    return ids


def fase1_coletar_ids():
    """
    Coleta todos os IDs únicos e salva em ids_coletados.json.
    Se o arquivo já existir, pula e retorna os IDs salvos.
    """
    if os.path.exists(IDS_FILE):
        with open(IDS_FILE, "r", encoding="utf-8") as f:
            ids = json.load(f)
        print(f"[Fase 1] ids_coletados.json já existe — {len(ids)} IDs carregados. Pulando.\n")
        return ids

    fatias = fatias_mensais(ANO_INICIO, ANO_FIM)
    total_fatias = len(fatias)
    todos_ids = set()

    print(f"[Fase 1] Fatiamento mensal: {total_fatias} intervalos "
          f"({ANO_INICIO}-01 → {ANO_FIM}-12)\n")

    for i, (inicio, fim) in enumerate(fatias, 1):
        dados_fatia = buscar_ids_por_intervalo(inicio, fim)
        novos = set(dados_fatia) - todos_ids
        todos_ids.update(novos)
        print(f"  [{i:>4}/{total_fatias}] {inicio} → {fim} "
              f"— {len(dados_fatia):>4} encontrados, "
              f"{len(novos):>4} novos (total: {len(todos_ids)})")

    ids_lista = list(todos_ids)

    with open(IDS_FILE, "w", encoding="utf-8") as f:
        json.dump(ids_lista, f)

    print(f"\n[Fase 1] Concluída. {len(ids_lista)} IDs salvos em ids_coletados.json\n")
    return ids_lista

# ---------------------------------------------------------------------------
# FASE 2 — Detalhes por filme
# ---------------------------------------------------------------------------

def slugify(text):
    text = unidecode(str(text)).lower()
    text = re.sub(r"[^a-z0-9]+", "-", text)
    return text.strip("-")


def poster_url(path, tamanho="w500"):
    return f"{POSTER_BASE}/{tamanho}{path}" if path else ""


def extrair_diretor(credits):
    for m in credits.get("crew", []):
        if m.get("job") == "Director":
            return m.get("name", "")
    return ""


def extrair_elenco(credits, limite=ELENCO_LIMIT):
    return [m["name"] for m in credits.get("cast", [])[:limite]]


def extrair_trailer(videos):
    for v in videos.get("results", []):
        if v.get("type") == "Trailer" and v.get("site") == "YouTube":
            return f"https://www.youtube.com/embed/{v['key']}"
    return ""


def montar_entrada(dados):
    tmdb_id     = dados.get("id")
    titulo      = dados.get("title", "")
    data_lanc   = dados.get("release_date") or ""
    ano         = int(data_lanc[:4]) if len(data_lanc) >= 4 else None
    sinopse     = dados.get("overview", "")
    avaliacao   = round(float(dados.get("vote_average") or 0), 1)
    path_poster = dados.get("poster_path") or ""
    credits     = dados.get("credits", {})
    videos      = dados.get("videos", {})

    return {
        "id":                       slugify(titulo),
        "tmdb_id":                  tmdb_id,
        "titulo":                   titulo,
        "ano":                      ano,
        "diretor":                  extrair_diretor(credits),
        "genero":                   [g["name"] for g in dados.get("genres", [])],
        "regiao":                   "",
        "estado":                   "",
        "produtora":                "",
        "sinopse":                  sinopse,
        "elenco":                   extrair_elenco(credits),
        "premios":                  [],
        "avaliacao":                avaliacao,
        "poster_path":              path_poster,
        "poster_url":               poster_url(path_poster, "w500"),
        "trailer":                  extrair_trailer(videos),
        "tags":                     [],
        "similares_internacionais": [],
    }


def buscar_detalhes(tmdb_id):
    params = {"append_to_response": "credits,videos", "language": "pt-BR"}
    return requisicao(f"{BASE_URL}/movie/{tmdb_id}", params=params)


def gravar_lote(lote, arquivo):
    """Grava uma lista de filmes no .jsonl e força escrita em disco."""
    for filme in lote:
        arquivo.write(json.dumps(filme, ensure_ascii=False) + "\n")
    arquivo.flush()
    os.fsync(arquivo.fileno())


def carregar_checkpoint():
    if not os.path.exists(CHECKPOINT):
        return 0
    with open(CHECKPOINT, "r", encoding="utf-8") as f:
        return json.load(f).get("processados", 0)


def salvar_checkpoint_fase2(processados):
    with open(CHECKPOINT, "w", encoding="utf-8") as f:
        json.dump({"processados": processados}, f)


def fase2_buscar_detalhes(todos_ids):
    """
    Processa os IDs em lotes de LOTE, grava no .jsonl e salva checkpoint.
    Retoma do último lote completo se interrompido.
    """
    total = len(todos_ids)
    ja_processados = carregar_checkpoint()

    if ja_processados > 0:
        print(f"[Fase 2] Checkpoint encontrado: {ja_processados}/{total} já processados.")
        resposta = input("Retomar de onde parou? (s/n): ").strip().lower()
        if resposta != "s":
            ja_processados = 0
            if os.path.exists(JSONL_PARCIAL):
                os.remove(JSONL_PARCIAL)
            if os.path.exists(CHECKPOINT):
                os.remove(CHECKPOINT)

    ids_pendentes = todos_ids[ja_processados:]
    processados   = ja_processados

    print(f"\n[Fase 2] {len(ids_pendentes)} filmes a processar "
          f"({ja_processados} já concluídos).\n")

    try:
        with open(JSONL_PARCIAL, "a", encoding="utf-8") as jsonl:
            lote_atual = []

            for tmdb_id in ids_pendentes:
                processados += 1
                dados = buscar_detalhes(tmdb_id)

                if dados:
                    filme = montar_entrada(dados)
                    lote_atual.append(filme)
                    print(f"  [{processados}/{total}] ✓ {filme['titulo']} ({filme['ano']})")
                else:
                    print(f"  [{processados}/{total}] ✗ ID {tmdb_id} — sem dados, pulado")

                time.sleep(RATE_DELAY)

                # Grava lote e salva checkpoint a cada LOTE filmes
                if len(lote_atual) >= LOTE:
                    gravar_lote(lote_atual, jsonl)
                    salvar_checkpoint_fase2(processados)
                    print(f"  — Lote gravado. Checkpoint: {processados}/{total} —")
                    lote_atual = []

            # Grava o lote final (< LOTE filmes)
            if lote_atual:
                gravar_lote(lote_atual, jsonl)
                salvar_checkpoint_fase2(processados)
                print(f"  — Lote final gravado. Checkpoint: {processados}/{total} —")

    except KeyboardInterrupt:
        print("\n\nInterrompido. Gravando lote parcial e salvando checkpoint...")
        if lote_atual:
            with open(JSONL_PARCIAL, "a", encoding="utf-8") as jsonl:
                gravar_lote(lote_atual, jsonl)
            salvar_checkpoint_fase2(processados)
        print(f"Checkpoint salvo em {processados}/{total}.")
        print("Rode novamente e escolha 's' para retomar.")
        sys.exit(0)

    print(f"\n[Fase 2] Concluída. {processados} filmes processados.")

# ---------------------------------------------------------------------------
# Exportação final
# ---------------------------------------------------------------------------

def jsonl_para_lista():
    filmes = []
    with open(JSONL_PARCIAL, "r", encoding="utf-8") as f:
        for linha in f:
            linha = linha.strip()
            if linha:
                try:
                    filmes.append(json.loads(linha))
                except json.JSONDecodeError:
                    pass
    return filmes


def salvar_json(filmes):
    os.makedirs(os.path.dirname(JSON_OUT), exist_ok=True)
    with open(JSON_OUT, "w", encoding="utf-8") as f:
        json.dump(filmes, f, ensure_ascii=False, indent=2)
    print(f"JSON → {JSON_OUT}  ({len(filmes)} filmes)")


def salvar_excel(filmes):
    df = pd.DataFrame(filmes)
    for col in ("genero", "elenco", "premios", "tags", "similares_internacionais"):
        if col in df.columns:
            df[col] = df[col].apply(
                lambda x: ", ".join(x) if isinstance(x, list) else x
            )
    df.to_excel(EXCEL_OUT, index=False, engine="openpyxl")
    print(f"Excel → {EXCEL_OUT}")

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    print("=" * 60)
    print("Cine Brasilis — Extração completa TMDB")
    print(f"Autenticação: {'Bearer Token' if TOKEN else 'API Key (fallback)'}")
    print("=" * 60 + "\n")

    # Fase 1 — IDs (pula se ids_coletados.json já existir)
    todos_ids = fase1_coletar_ids()

    # Fase 2 — Detalhes
    fase2_buscar_detalhes(todos_ids)

    # Exportação final
    print("\nConvertendo para JSON e Excel...")
    filmes = jsonl_para_lista()
    salvar_json(filmes)
    salvar_excel(filmes)

    # Limpa arquivos temporários
    for arq in (JSONL_PARCIAL, CHECKPOINT, IDS_FILE):
        if os.path.exists(arq):
            os.remove(arq)

    print("\nExtração concluída.")


if __name__ == "__main__":
    main()
