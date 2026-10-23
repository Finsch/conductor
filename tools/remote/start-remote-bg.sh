#!/usr/bin/env bash
# conductor. — relais de la télécommande sans terminal (bouton « Démarrer la télécommande »)
cd "$(dirname "$(readlink -f "$0")")" || exit 1
nohup node relay.js --log >/dev/null 2>>relay-errors.log &
