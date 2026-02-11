#!/bin/bash
# =============================================================================
# Script de Configuração - LagostaCRM Server
# Hetzner CPX22 + EasyPanel + WPPConnect + n8n
# =============================================================================

set -e  # Parar em caso de erro

echo "=========================================="
echo "  LagostaCRM Server Setup"
echo "=========================================="

# Cores para output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# -----------------------------------------------------------------------------
# 1. Atualizar sistema
# -----------------------------------------------------------------------------
echo -e "${YELLOW}[1/4] Atualizando sistema...${NC}"
apt update && apt upgrade -y

# -----------------------------------------------------------------------------
# 2. Instalar dependências básicas
# -----------------------------------------------------------------------------
echo -e "${YELLOW}[2/4] Instalando dependências...${NC}"
apt install -y curl wget git htop

# -----------------------------------------------------------------------------
# 3. Instalar EasyPanel
# -----------------------------------------------------------------------------
echo -e "${YELLOW}[3/4] Instalando EasyPanel...${NC}"
curl -sSL https://get.easypanel.io | sh

# -----------------------------------------------------------------------------
# 4. Configurar Firewall (UFW)
# -----------------------------------------------------------------------------
echo -e "${YELLOW}[4/4] Configurando firewall...${NC}"
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS
ufw allow 3000/tcp  # EasyPanel (temporário, depois remove)
ufw --force enable

# -----------------------------------------------------------------------------
# Resultado
# -----------------------------------------------------------------------------
echo ""
echo -e "${GREEN}=========================================="
echo "  Setup concluído!"
echo "==========================================${NC}"
echo ""
echo "Próximos passos:"
echo ""
echo "1. Acesse o EasyPanel:"
echo "   http://$(curl -s ifconfig.me):3000"
echo ""
echo "2. Crie sua conta admin no EasyPanel"
echo ""
echo "3. No EasyPanel, crie os seguintes apps:"
echo "   - n8n (imagem: n8nio/n8n:latest)"
echo "   - redis (imagem: redis:alpine)"
echo "   - wppconnect (imagem: wppconnect/server-cli:latest)"
echo ""
echo "4. Configure os domínios no EasyPanel:"
echo "   - n8n.seudominio.com"
echo "   - wpp.seudominio.com"
echo ""
echo "5. Após configurar domínios, remova acesso direto ao EasyPanel:"
echo "   ufw delete allow 3000/tcp"
echo ""
