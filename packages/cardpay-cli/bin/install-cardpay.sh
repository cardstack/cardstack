#!/bin/sh
set -e

reset="\033[0m"
red="\033[31m"
green="\033[32m"
yellow="\033[33m"
cyan="\033[36m"
white="\033[37m"
CARDPAY_BIN=".cardpay/bin"

get_tarball() {
  printf "$cyan> Downloading tarball...$reset\n"
  url=https://install.cardstack.com/cardpay.tgz
  tarball_tmp=$(mktemp)
  if curl --fail -L -o "$tarball_tmp" "$url"; then
    printf "$cyan> Extracting to ~/.cardpay...$reset\n"
    temp=$(mktemp -d cardpay.XXXXXXXXXX)
    tar zxf $tarball_tmp -C "$temp"
    rm -rf .cardpay
    mkdir -p .cardpay
    mv -f "$temp"/* .cardpay
    rm -rf "$temp"
    rm $tarball_tmp*
  else
    printf "$red> Failed to download $url.$reset\n"
    exit 1
  fi
}

make_link() {
  printf "$cyan> Adding to \$PATH...$reset\n"
  PROFILE="$(detect_profile)"
  SOURCE_STR="\nexport PATH=\"\$HOME/$CARDPAY_BIN:\$PATH\"\n"

  if [ -z "${PROFILE-}" ]; then
    printf "$red> Profile not found. Tried ${PROFILE} (as defined in \$PROFILE), ~/.bashrc, ~/.bash_profile, ~/.zshrc, and ~/.profile.\n"
    echo "> Create one of them and run this script again"
    echo "> Create it (touch ${PROFILE}) and run this script again"
    echo "   OR"
    printf "> Append the following lines to the correct file yourself:$reset\n"
    command printf "${SOURCE_STR}"
  else
    if ! grep -q "$CARDPAY_BIN" "$PROFILE"; then
      if [[ $PROFILE == *"fish"* ]]; then
        command fish -c "set -U fish_user_paths \$fish_user_paths ~/$CARDPAY_BIN"
        printf "$cyan> We've added ~/$CARDPAY_BIN to your fish_user_paths universal variable\n"
      else
        command printf "$SOURCE_STR" >>"$PROFILE"
        printf "$cyan> We've added the following to your $PROFILE\n"
      fi

      echo "> If this isn't the profile of your current shell then please add the following to your correct profile:"
      printf "   $SOURCE_STR$reset\n"
    fi

    printf "$green> Successfully installed Cardpay CLI. Please open another terminal where the \`cardpay\` command will now be available.$reset\n"
  fi
}

detect_profile() {
  if [ -n "${PROFILE}" ] && [ -f "${PROFILE}" ]; then
    echo "${PROFILE}"
    return
  fi

  local DETECTED_PROFILE
  DETECTED_PROFILE=''
  local SHELLTYPE
  SHELLTYPE="$(basename "/$SHELL")"

  if [ "$SHELLTYPE" = "bash" ]; then
    if [ -f "$HOME/.bashrc" ]; then
      DETECTED_PROFILE="$HOME/.bashrc"
    elif [ -f "$HOME/.bash_profile" ]; then
      DETECTED_PROFILE="$HOME/.bash_profile"
    fi
  elif [ "$SHELLTYPE" = "zsh" ]; then
    DETECTED_PROFILE="$HOME/.zshrc"
  elif [ "$SHELLTYPE" = "fish" ]; then
    DETECTED_PROFILE="$HOME/.config/fish/config.fish"
  fi

  if [ -z "$DETECTED_PROFILE" ]; then
    if [ -f "$HOME/.profile" ]; then
      DETECTED_PROFILE="$HOME/.profile"
    elif [ -f "$HOME/.bashrc" ]; then
      DETECTED_PROFILE="$HOME/.bashrc"
    elif [ -f "$HOME/.bash_profile" ]; then
      DETECTED_PROFILE="$HOME/.bash_profile"
    elif [ -f "$HOME/.zshrc" ]; then
      DETECTED_PROFILE="$HOME/.zshrc"
    elif [ -f "$HOME/.config/fish/config.fish" ]; then
      DETECTED_PROFILE="$HOME/.config/fish/config.fish"
    fi
  fi

  if [ ! -z "$DETECTED_PROFILE" ]; then
    echo "$DETECTED_PROFILE"
  fi
}

reset() {
  unset -f install reset get_tarball make_link detect_profile
}

install() {
  printf "${white}Installing Cardpay CLI$reset\n"

  get_tarball
  make_link
  reset
}

cd ~
install
