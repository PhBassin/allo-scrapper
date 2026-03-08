#!/usr/bin/env bash
#
# migrate-env.sh - Migrate .env file to match .env.example template
#
# This script:
# 1. Backs up current .env to .env-YYYY-MM-DD-HHMMSS
# 2. Generates new .env based on .env.example template
# 3. Injects existing values from old .env into new .env
# 4. Preserves all comments and structure from .env.example
#
# Usage: ./scripts/migrate-env.sh [OPTIONS]
#
# Compatible with bash 3.2+ (macOS default bash)
#

set -euo pipefail

# ============================================================================
# CONFIGURATION
# ============================================================================
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$PROJECT_ROOT/.env"
ENV_EXAMPLE="$PROJECT_ROOT/.env.example"
TIMESTAMP=$(date +%Y-%m-%d-%H%M%S)
BACKUP_FILE="$PROJECT_ROOT/.env-$TIMESTAMP"

# Temporary files for parsing (bash 3.2 compatible)
TEMP_OLD_VARS=$(mktemp)
TEMP_NEW_VARS=$(mktemp)
TEMP_PRESERVED=$(mktemp)

# Cleanup on exit
trap 'rm -f "$TEMP_OLD_VARS" "$TEMP_NEW_VARS" "$TEMP_PRESERVED"' EXIT

# ============================================================================
# COLORS & LOGGING
# ============================================================================
readonly COLOR_RESET='\033[0m'
readonly COLOR_BOLD='\033[1m'
readonly COLOR_RED='\033[31m'
readonly COLOR_GREEN='\033[32m'
readonly COLOR_YELLOW='\033[33m'
readonly COLOR_BLUE='\033[34m'
readonly COLOR_CYAN='\033[36m'

info() {
  echo -e "${COLOR_BLUE}ℹ${COLOR_RESET} $*"
}

success() {
  echo -e "${COLOR_GREEN}✓${COLOR_RESET} $*"
}

warning() {
  echo -e "${COLOR_YELLOW}⚠${COLOR_RESET} $*"
}

error() {
  echo -e "${COLOR_RED}✗${COLOR_RESET} $*" >&2
}

header() {
  echo -e "\n${COLOR_BOLD}${COLOR_CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${COLOR_RESET}\n"
}

# ============================================================================
# UTILITY FUNCTIONS
# ============================================================================

show_help() {
  cat << EOF
${COLOR_BOLD}Migration du fichier .env${COLOR_RESET}

${COLOR_BOLD}Usage:${COLOR_RESET}
  $0 [OPTIONS]

${COLOR_BOLD}Description:${COLOR_RESET}
  Ce script migre votre fichier .env actuel vers le nouveau template .env.example
  tout en préservant vos valeurs de configuration existantes.

${COLOR_BOLD}Options:${COLOR_RESET}
  --dry-run     Prévisualiser les changements sans les appliquer
                (affiche le rapport mais ne modifie aucun fichier)
  
  --force       Pas de confirmation interactive
                (applique directement la migration)
  
  -h, --help    Afficher cette aide

${COLOR_BOLD}Exemples:${COLOR_RESET}
  $0                  # Migration normale avec confirmation
  $0 --dry-run        # Prévisualiser uniquement
  $0 --force          # Migration automatique (CI/CD)

${COLOR_BOLD}Fonctionnement:${COLOR_RESET}
  1. Sauvegarde de .env → .env-YYYY-MM-DD-HHMMSS
  2. Lecture des valeurs existantes depuis .env
  3. Génération d'un nouveau .env basé sur .env.example
  4. Injection des valeurs existantes dans le nouveau .env
  5. Préservation de tous les commentaires de .env.example

${COLOR_BOLD}Note:${COLOR_RESET}
  Les variables présentes dans .env mais absentes de .env.example
  seront ignorées (considérées comme obsolètes).

EOF
}

check_files_exist() {
  local has_error=false

  if [[ ! -f "$ENV_FILE" ]]; then
    error "Fichier .env introuvable: $ENV_FILE"
    has_error=true
  fi

  if [[ ! -f "$ENV_EXAMPLE" ]]; then
    error "Fichier .env.example introuvable: $ENV_EXAMPLE"
    has_error=true
  fi

  if [[ "$has_error" == true ]]; then
    exit 1
  fi
}

# ============================================================================
# PARSING FUNCTIONS
# ============================================================================

# Parse .env file and save to temp file as "VAR_NAME=value" pairs
# Usage: parse_env_file <filepath> <output_file>
parse_env_file() {
  local filepath="$1"
  local output="$2"
  
  # Clear output file
  > "$output"
  
  while IFS= read -r line || [[ -n "$line" ]]; do
    # Skip empty lines
    [[ -z "$line" ]] && continue
    
    # Skip comments
    [[ "$line" =~ ^[[:space:]]*# ]] && continue
    
    # Skip lines without =
    [[ ! "$line" =~ = ]] && continue
    
    # Extract variable name (before first =)
    local var_name="${line%%=*}"
    
    # Remove leading/trailing whitespace from var_name
    var_name="${var_name#"${var_name%%[![:space:]]*}"}"
    var_name="${var_name%"${var_name##*[![:space:]]}"}"
    
    # Skip if var_name is empty
    [[ -z "$var_name" ]] && continue
    
    # Extract value (after first =, preserve everything including quotes)
    local var_value="${line#*=}"
    
    # Save to output file
    echo "${var_name}=${var_value}" >> "$output"
  done < "$filepath"
}

# Get value for a variable from parsed env file
# Usage: get_var_value <var_name> <parsed_file>
get_var_value() {
  local var_name="$1"
  local parsed_file="$2"
  
  # Use grep to find the variable and extract its value
  local result
  result=$(grep "^${var_name}=" "$parsed_file" 2>/dev/null | head -1 | cut -d= -f2-)
  
  echo "$result"
}

# Count number of variables in a .env file
count_variables() {
  local filepath="$1"
  local count=0
  
  while IFS= read -r line || [[ -n "$line" ]]; do
    # Skip empty lines and comments
    [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]] && continue
    
    # Count lines with =
    [[ "$line" =~ = ]] && ((count++))
  done < "$filepath"
  
  echo "$count"
}

# Get file size in bytes
get_file_size() {
  local filepath="$1"
  
  if [[ "$(uname)" == "Darwin" ]]; then
    # macOS
    stat -f "%z" "$filepath"
  else
    # Linux
    stat -c "%s" "$filepath"
  fi
}

# ============================================================================
# GENERATION FUNCTION
# ============================================================================

# Generate new .env content based on .env.example with injected values
# Usage: generate_new_env <parsed_old_vars_file> <output_file>
generate_new_env() {
  local old_vars_file="$1"
  local output_file="$2"
  
  # Clear output files
  > "$output_file"
  > "$TEMP_NEW_VARS"
  > "$TEMP_PRESERVED"
  
  while IFS= read -r line || [[ -n "$line" ]]; do
    # Case 1: Empty line or comment - copy as-is
    if [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]]; then
      echo "$line" >> "$output_file"
      continue
    fi
    
    # Case 2: Line with variable (contains =)
    if [[ "$line" =~ = ]]; then
      # Extract variable name (before first =)
      local var_name="${line%%=*}"
      var_name="${var_name#"${var_name%%[![:space:]]*}"}"
      var_name="${var_name%"${var_name##*[![:space:]]}"}"
      
      # Get value from old .env if exists
      local old_value
      old_value=$(get_var_value "$var_name" "$old_vars_file")
      
      if [[ -n "$old_value" ]]; then
        # Use value from old .env
        echo "${var_name}=${old_value}" >> "$output_file"
        echo "$var_name" >> "$TEMP_PRESERVED"
      else
        # Keep default value from .env.example
        echo "$line" >> "$output_file"
        
        # Extract default value for reporting
        local default_value="${line#*=}"
        # Truncate if too long
        if [[ ${#default_value} -gt 50 ]]; then
          default_value="${default_value:0:47}..."
        fi
        echo "${var_name} (défaut: ${default_value})" >> "$TEMP_NEW_VARS"
      fi
    else
      # Fallback: copy line as-is
      echo "$line" >> "$output_file"
    fi
  done < "$ENV_EXAMPLE"
}

# ============================================================================
# REPORTING FUNCTION
# ============================================================================

show_migration_report() {
  # Count variables
  local old_count
  old_count=$(count_variables "$ENV_FILE")
  local example_count
  example_count=$(count_variables "$ENV_EXAMPLE")
  
  # Get file sizes
  local old_size
  old_size=$(get_file_size "$ENV_FILE")
  local example_size
  example_size=$(get_file_size "$ENV_EXAMPLE")
  
  # Count preserved and new variables
  local preserved_count
  preserved_count=$(wc -l < "$TEMP_PRESERVED" | tr -d ' ')
  local new_count
  new_count=$(wc -l < "$TEMP_NEW_VARS" | tr -d ' ')
  
  # Display report
  header
  echo -e "${COLOR_BOLD}🔄 Migration du fichier .env${COLOR_RESET}"
  header
  
  echo -e "${COLOR_BOLD}📁 Fichiers:${COLOR_RESET}"
  echo -e "  Source:   .env (${old_size} bytes, ${old_count} variables)"
  echo -e "  Template: .env.example (${example_size} bytes, ${example_count} variables)"
  echo -e "  Backup:   .env-${TIMESTAMP}"
  
  echo -e "\n${COLOR_BOLD}📊 Analyse:${COLOR_RESET}\n"
  
  if [[ "$preserved_count" -gt 0 ]]; then
    echo -e "  ${COLOR_GREEN}✅ Préservées (${preserved_count} variables):${COLOR_RESET}"
    while IFS= read -r var; do
      echo -e "    ${var}"
    done < "$TEMP_PRESERVED"
  fi
  
  if [[ "$new_count" -gt 0 ]]; then
    echo -e "\n  ${COLOR_CYAN}✨ Nouvelles (${new_count} variables):${COLOR_RESET}"
    while IFS= read -r var; do
      echo -e "    ${var}"
    done < "$TEMP_NEW_VARS"
  fi
  
  header
  echo -e "${COLOR_YELLOW}⚠️  Le fichier .env actuel sera sauvegardé puis remplacé.${COLOR_RESET}\n"
}

# ============================================================================
# BACKUP & MIGRATION
# ============================================================================

create_backup() {
  cp "$ENV_FILE" "$BACKUP_FILE"
  success "Backup créé: $BACKUP_FILE"
}

apply_migration() {
  local new_env_file="$1"
  cp "$new_env_file" "$ENV_FILE"
  success "Nouveau .env généré avec succès"
}

# ============================================================================
# MAIN FUNCTION
# ============================================================================

main() {
  # Check prerequisites
  check_files_exist
  
  # Parse old .env file
  parse_env_file "$ENV_FILE" "$TEMP_OLD_VARS"
  
  # Generate new .env content in temporary file
  TEMP_NEW_ENV=$(mktemp)
  trap 'rm -f "$TEMP_OLD_VARS" "$TEMP_NEW_VARS" "$TEMP_PRESERVED" "$TEMP_NEW_ENV"' EXIT
  
  generate_new_env "$TEMP_OLD_VARS" "$TEMP_NEW_ENV"
  
  # Show migration report
  show_migration_report
  
  # Handle dry-run mode
  if [[ "$DRY_RUN" == true ]]; then
    info "Mode dry-run - aucun changement appliqué"
    echo ""
    info "Pour appliquer la migration, exécutez:"
    echo -e "  ${COLOR_BOLD}$0${COLOR_RESET}"
    echo ""
    exit 0
  fi
  
  # Ask for confirmation (unless --force)
  if [[ "$FORCE" != true ]]; then
    read -p "Procéder à la migration ? [y/N] " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
      warning "Migration annulée"
      exit 0
    fi
  fi
  
  # Perform migration
  header
  create_backup
  apply_migration "$TEMP_NEW_ENV"
  
  header
  success "Migration terminée avec succès!"
  echo ""
  info "Fichiers:"
  echo -e "  • Nouveau .env: ${COLOR_GREEN}$ENV_FILE${COLOR_RESET}"
  echo -e "  • Backup:       ${COLOR_CYAN}$BACKUP_FILE${COLOR_RESET}"
  echo ""
}

# ============================================================================
# ARGUMENT PARSING
# ============================================================================

DRY_RUN=false
FORCE=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    --force)
      FORCE=true
      shift
      ;;
    -h|--help)
      show_help
      exit 0
      ;;
    *)
      error "Option inconnue: $1"
      echo ""
      show_help
      exit 1
      ;;
  esac
done

# ============================================================================
# EXECUTION
# ============================================================================

main
