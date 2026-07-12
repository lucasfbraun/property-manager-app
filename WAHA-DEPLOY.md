# Deploy do WAHA (WhatsApp HTTP API) na AWS Lightsail

Guia de instalacao do WAHA na instancia Ubuntu criada na Lightsail (IP estatico
`34.192.69.176`).

## Variante escolhida: sem SSL

Por decisao explicita, esta instalacao roda **sem HTTPS** — o Worker chama
`http://34.192.69.176:3000` direto pelo IP. Isso e' mais simples (sem
dominio, sem Certbot), mas a API key do WAHA e o conteudo das mensagens
trafegam em texto puro pela internet entre a Cloudflare e a AWS. Risco a ter
em mente, dado que esse WAHA vai lidar com nomes/telefones de inquilinos:
qualquer ponto intermediario da rede consegue ler esse trafego. Mitigacoes
minimas: usar uma API key longa e unica (nao reaproveitar de outro lugar) e
trocar essa chave periodicamente. Se decidir adicionar HTTPS depois, e' so'
seguir o apendice "Adicionar SSL depois" no fim deste documento.

## Pre-requisito

Nenhum — so' o IP estatico ja anexado, `34.192.69.176`.

## Licao aprendida: plano da instancia

A instancia inicial foi criada no plano de **US$5/mes (512MB de RAM)**, o que causou quedas de conexao SSH e do proprio WAHA por falta de memoria (sem swap configurado, o Linux mata processos aleatoriamente quando a RAM acaba). Duas correcoes foram aplicadas, nessa ordem:

1. **Swap de emergencia** (rapido, gratuito, resolve na hora):
   ```bash
   sudo fallocate -l 1G /swapfile
   sudo chmod 600 /swapfile
   sudo mkswap /swapfile
   sudo swapon /swapfile
   echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
   ```
2. **Upgrade definitivo do plano** (o que resolveu de vez): criar um **snapshot** da instancia (menu da instancia > "Create snapshot"), depois "Create instance" a partir do snapshot escolhendo um plano maior (usado: US$7/mes, 1GB — ja` suficiente com folga). Depois, mover o **IP estatico** da instancia antiga pra nova (Networking > IP estatico > Detach/Attach) e conferir se o firewall da instancia nova tem a regra **Custom TCP 3000** (nem sempre copia certinho do snapshot). O Docker e o container sobem sozinhos no boot (`restart: unless-stopped`), sem precisar refazer a instalacao.

Recomendacao pra quem for instalar do zero: comece direto no plano de **1GB (US$7/mes)** pra evitar essa instabilidade — o de 512MB so' e' viavel com swap, e mesmo assim fica no limite.

## 1. Conectar na instancia

Na lista de instancias da Lightsail, clique no icone de terminal (SSH direto
no navegador) ao lado da instancia.

## 2. Atualizar o sistema e instalar o Docker

```bash
sudo apt update && sudo apt upgrade -y
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
newgrp docker
docker --version
```

## 3. Liberar a porta 3000 no firewall da Lightsail

Pelo console (aba "Networking" da instancia, nao pelo terminal): clique em
"Add rule" e adicione TCP na porta 3000, restrito a "Any IPv4 address" (o
Worker da Cloudflare nao tem IP de saida fixo, entao nao da' pra restringir
por IP especifico).

## 4. Criar a pasta do projeto e o docker-compose.yml

```bash
mkdir -p ~/waha/sessions
cd ~/waha
nano docker-compose.yml
```

Cole o conteudo abaixo (troque `TROQUE_POR_UMA_CHAVE_FORTE` por uma chave
aleatoria forte e unica — essa e' a senha que o Worker vai usar pra chamar o
WAHA; pode gerar uma com `openssl rand -hex 32` em outro terminal):

```yaml
services:
  waha:
    image: devlikeapro/waha:latest
    restart: unless-stopped
    ports:
      - "0.0.0.0:3000:3000"
    environment:
      - WHATSAPP_DEFAULT_ENGINE=NOWEB
      - WAHA_API_KEY=TROQUE_POR_UMA_CHAVE_FORTE
      - WHATSAPP_RESTART_ALL_SESSIONS=True
    volumes:
      - ./sessions:/app/.sessions
```

Note que aqui a porta e' publicada em `0.0.0.0` (todas as interfaces) — e'
isso que expõe o container direto pra internet, ja que nao ha' Nginx na
frente nessa variante.

## 5. Subir o container

```bash
docker compose up -d
docker compose logs -f
```

(Ctrl+C sai do modo de acompanhar o log; o container continua rodando em
background.)

## 6. Testar a API

```bash
curl http://34.192.69.176:3000/api/sessions -H "X-Api-Key: TROQUE_POR_UMA_CHAVE_FORTE"
```

Deve responder algo como `[]` (lista vazia de sessoes) — confirma que a API
esta acessivel de fora.

## 7. Criar a sessao e ler o QR code

Pelo painel web (`http://34.192.69.176:3000/dashboard`, login com a mesma
API key) ou via API, inicie uma sessao chamada `default` e escaneie o QR
code com o WhatsApp do numero que vai enviar os lembretes. A sessao fica
salva em `~/waha/sessions` na instancia (por isso o volume no passo 4) — nao
precisa escanear de novo a cada restart do container.

## Variaveis a configurar no Worker (Cloudflare)

- `WAHA_BASE_URL` = `http://34.192.69.176:3000`
- `WAHA_API_KEY` = a mesma chave definida no `docker-compose.yml`
- `WAHA_SESSION` = `default` (ou o nome escolhido acima)

Essas ja sao as variaveis referenciadas em `app/lib/integrations.ts` /
`app/integracoes/page.tsx` (`wahaBaseUrlEnv`, `wahaApiKeyEnv`,
`wahaSessionEnv`).

---

## Apendice: adicionar SSL depois

Se mais pra frente quiser trocar pra HTTPS (recomendado antes de operar com
inquilinos reais), o caminho mais simples e' via Cloudflare (sem precisar de
Certbot no servidor, se o dominio da aplicacao ja estiver na Cloudflare):

1. Criar um registro DNS tipo A apontando um subdominio (ex:
   `waha.grupoflexivel.com.br`) pro IP `34.192.69.176`, com o proxy da
   Cloudflare **ligado** (nuvem laranja).
2. Em SSL/TLS no painel da Cloudflare, usar o modo "Flexible" — a Cloudflare
   termina o HTTPS pro mundo externo e conversa com a Lightsail via HTTP
   simples (que ja esta' rodando).
3. Trocar `WAHA_BASE_URL` no Worker pra `https://waha.grupoflexivel.com.br`.

Isso remove o problema de trafego em texto puro entre o usuario final da
internet e a Cloudflare, mas o trecho Cloudflare-para-Lightsail continua sem
criptografia — ainda assim, e' uma melhora significativa e nao exige nenhuma
mudanca na instancia. Pra criptografia ponta a ponta completa, o caminho e'
o Nginx + Certbot (modo "Full (strict)" na Cloudflare), que exige o dominio
configurado antes de emitir o certificado.
