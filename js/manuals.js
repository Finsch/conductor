// conductor. — contenu des guides (pages manuals.html et manual.html?g=…)
//
// Chaque guide : des parties, chaque partie des étapes numérotées.
// Étape : { title, body (HTML), code (commande à copier), choices (variantes
// au choix : [{ label, body }]), tip (encadré conseil) }.
// Les étapes faites se cochent ; c'est gardé dans le navigateur.

const MANUALS = [

  // ===================================================================
  {
    id: "navidrome-installation",
    title: "Installer Navidrome sur le téléphone",
    short: "Une seule fois : Termux, Navidrome, votre compte, puis la connexion à conductor.",
    icon: "install",
    time: "15 à 20 min, une seule fois",
    intro: "Navidrome est un petit serveur musical. Il tourne sur le téléphone (Samsung A12) dans l'appli Termux et envoie vos MP3/FLAC à conductor., sans les copier sur le PC. Ce guide l'installe ; ensuite, suivez « Écouter les fichiers du téléphone » à chaque session.",
    parts: [
      {
        title: "Installer les outils",
        steps: [
          {
            title: "Installer F-Droid puis Termux",
            body: "<p>Sur le téléphone, installez <b>F-Droid</b> depuis <code>https://f-droid.org</code>, puis, dans F-Droid, installez <b>Termux</b>.</p><p>Ouvrez Termux : c'est là qu'on tape les commandes (puis Entrée).</p>",
            tip: "Pas la version de Termux du Play Store : elle n'est plus mise à jour et l'installation de Navidrome échoue."
          },
          {
            title: "Préparer Termux",
            body: "<p>Tapez ces deux commandes. La seconde ouvre une fenêtre Android : <b>acceptez</b> (accès à vos fichiers).</p>",
            code: "pkg update && pkg upgrade\ntermux-setup-storage"
          },
          {
            title: "Installer Navidrome",
            body: "<p>ffmpeg et taglib (lecture des tags) sont installés avec.</p>",
            code: "pkg install navidrome"
          }
        ]
      },
      {
        title: "Configurer",
        steps: [
          {
            title: "Trouver le dossier de votre musique",
            body: "<p>Vos albums s'affichent ? Le dossier est <code>~/storage/shared/Music</code>.</p>",
            code: "ls ~/storage/shared/Music",
            choices: [
              { label: "Ailleurs dans le téléphone", body: "<p>Explorez avec <code>ls ~/storage/shared</code>, puis descendez dans les dossiers.</p>" },
              { label: "Sur la carte SD", body: "<p><code>ls /storage</code> : la carte apparaît sous un nom comme <code>1A2B-3C4D</code>. Le dossier sera <code>/storage/1A2B-3C4D/Music</code>.</p>" },
              { label: "Téléphone et carte SD", body: "<p>Les deux à la fois : suivez la partie « Ajouter une carte SD » à la fin de ce guide, puis utilisez <code>$HOME/musique</code> comme <code>ND_MUSICFOLDER</code>.</p>" }
            ]
          },
          {
            title: "Créer le script de démarrage",
            body: "<p>Copiez tout le bloc d'un coup dans Termux. Adaptez la ligne <code>ND_MUSICFOLDER</code> si votre musique est ailleurs.</p>",
            code: "cat > ~/navidrome.sh <<'EOF'\ntermux-wake-lock\nexport ND_MUSICFOLDER=\"$HOME/storage/shared/Music\"\nexport ND_DATAFOLDER=\"$HOME/navidrome-data\"\nexport ND_PORT=4533\nmkdir -p \"$ND_DATAFOLDER\"\nnavidrome\nEOF\nchmod +x ~/navidrome.sh",
            tip: "<code>termux-wake-lock</code> empêche Android d'endormir Termux pendant que le serveur tourne."
          },
          {
            title: "Empêcher Android de couper Termux",
            body: "<p>Paramètres → Applications → <b>Termux</b> → Batterie → <b>Non restreinte</b>.</p>"
          }
        ]
      },
      {
        title: "Premier lancement",
        steps: [
          {
            title: "Lancer Navidrome",
            body: "<p>Laissez Termux ouvert (vous pouvez revenir à l'accueil : une notification Termux reste affichée).</p><p>La première fois, Navidrome analyse toute votre musique : <b>plusieurs minutes</b>.</p>",
            code: "~/navidrome.sh",
            tip: "Pour arrêter : <b>Ctrl</b> + <b>C</b> dans Termux (bouton CTRL au-dessus du clavier), ou « Exit » dans la notification."
          },
          {
            title: "Trouver l'adresse du téléphone",
            body: "<p>Paramètres Android → Connexions → Wi-Fi → ⚙️ à côté du réseau → <b>Adresse IP</b>.</p>",
            choices: [
              { label: "Adresse courte (IPv4)", body: "<p>Par exemple <code>192.168.1.23</code> → adresse du serveur : <code>192.168.1.23:4533</code>.</p>" },
              { label: "Seulement des adresses longues (IPv6)", body: "<p>Prenez celle qui contient <code>ff:fe</code> (ni celle en <code>fe80</code>, ni l'autre, temporaire). Dans le navigateur, elle se met entre crochets : <code>http://[2a04:…:fe7c:e1e9]:4533</code>. Dans conductor., collez-la telle quelle.</p>" },
              { label: "Autre réseau, câble USB", body: "<p>Voir le guide « Écouter les fichiers du téléphone » : chaque façon de relier le PC au téléphone y a son étape.</p>" }
            ]
          },
          {
            title: "Créer votre compte Navidrome",
            body: "<p>Sur le PC (même réseau), ouvrez l'adresse dans Chrome, par exemple <code>http://192.168.1.23:4533</code>. Navidrome demande de créer le premier compte : choisissez un <b>utilisateur</b> et un <b>mot de passe</b>.</p>"
          },
          {
            title: "Connecter conductor.",
            body: "<p>conductor. → <b>audio-files</b> → adresse, utilisateur, mot de passe → <b>Se connecter</b>.</p><p>Le mot de passe n'est pas enregistré : le site garde seulement un jeton dérivé.</p>",
            tip: "Vos albums sur le téléphone sont reliés tout seuls à ceux de la collection (même titre, même artiste). Ceux qui manquent sont listés dans audio-files, prêts à être ajoutés."
          }
        ]
      },
      {
        title: "Bien taguer vos fichiers",
        steps: [
          {
            title: "Les mêmes tags pour toutes les pistes d'un album",
            body: "<p>Navidrome regroupe les pistes d'un album seulement si <b>toutes</b> ont le même <b>Album</b>, le même <b>Album Artist</b> (sans « feat. ») et la même <b>année</b>. Une seule piste différente coupe l'album en deux.</p><p>conductor. réunit ces morceaux (« réuni (18 + 1) » dans audio-files), mais corriger les tags rend tout propre partout.</p>",
            tip: "Sur le PC, <b>TagScanner</b> (gratuit, <code>xdlab.ru</code>) corrige les tags de toutes les pistes d'un album d'un coup : voir le guide « De YouTube à conductor. »."
          },
          {
            title: "Ce que conductor. lit aussi dans vos fichiers",
            body: "<ul><li><b>numéros de piste et de disque</b> : ordre et numérotation ;</li><li><b>pochette intégrée</b> ;</li><li><b>paroles intégrées</b> (USLT / LYRICS), simples ou synchronisées.</li></ul>"
          }
        ]
      },
      {
        title: "Ajouter une carte SD (téléphone + carte)",
        steps: [
          {
            title: "Trouver la carte et sa musique",
            body: "<p>Carte insérée, dans Termux : la carte apparaît sous un nom comme <code>1A2B-3C4D</code> (ignorez <code>emulated</code> et <code>self</code>). Puis <code>ls /storage/1A2B-3C4D</code> pour repérer le dossier de musique, par exemple <code>Music</code>.</p>",
            code: "ls /storage",
            tip: "« Permission denied » ? Refaites <code>termux-setup-storage</code> et acceptez. Toujours bloqué : Android limite Termux sur cette carte ; mettez la musique dans le dossier réservé à Termux, <code>~/storage/external-1</code>, et utilisez ce chemin à l'étape suivante."
          },
          {
            title: "Regrouper téléphone et carte dans un seul dossier",
            body: "<p>Navidrome ne lit qu'un dossier : on en crée un qui contient des <b>liens</b> vers les deux (Navidrome les suit). Remplacez <code>Music</code> (dossier du téléphone, ex. <code>dawn-fm</code>) et <code>1A2B-3C4D/Music</code> par les vôtres.</p>",
            code: "mkdir -p ~/musique\nln -s ~/storage/shared/Music ~/musique/telephone\nln -s /storage/1A2B-3C4D/Music ~/musique/carte-sd",
            tip: "Vérifiez : <code>ls ~/musique/carte-sd</code> doit afficher vos albums de la carte."
          },
          {
            title: "Dire à Navidrome de lire ce dossier",
            body: "<p>Changez la ligne <code>ND_MUSICFOLDER</code> de <code>~/navidrome.sh</code> :</p>",
            code: "sed -i 's#^export ND_MUSICFOLDER=.*#export ND_MUSICFOLDER=\"$HOME/musique\"#' ~/navidrome.sh"
          },
          {
            title: "Relancer et actualiser",
            body: "<p>Arrêtez Navidrome (<b>Ctrl</b> + <b>C</b> ou widget <b>conductor-stop</b>), relancez-le : il réanalyse toute la musique (quelques minutes). Puis conductor. → <b>audio-files</b> → <b>Actualiser</b>.</p>",
            tip: "Carte retirée : ses albums disparaissent de Navidrome, et reviennent quand elle est remise. L'envoi par WinSCP sur la carte n'est permis que dans <code>~/storage/external-1</code> : continuez plutôt à envoyer dans le dossier du téléphone."
          }
        ]
      }
    ],
    trouble: [
      ["pkg install navidrome : paquet introuvable", "Refaites <code>pkg update</code> ; vérifiez que Termux vient de F-Droid."],
      ["Navidrome ne voit aucun album", "Vérifiez le dossier avec <code>ls</code> (étape 4), corrigez <code>ND_MUSICFOLDER</code> dans <code>~/navidrome.sh</code>, relancez."],
      ["« Utilisateur ou mot de passe incorrect »", "Ce sont ceux créés à l'étape 9, pas ceux du téléphone."],
      ["Un album est coupé en plusieurs morceaux", "Tags différents entre pistes : voir « Bien taguer vos fichiers »."]
    ]
  },

  // ===================================================================
  {
    id: "navidrome-quotidien",
    title: "Écouter les fichiers du téléphone",
    short: "À chaque session : lancer Navidrome, relier le PC (wifi, point d'accès ou câble USB, même sans carte SIM), écouter.",
    icon: "daily",
    time: "2 min par session",
    intro: "Navidrome est déjà installé (sinon : guide « Installer Navidrome sur le téléphone »). Choisissez comment relier le PC et le téléphone ; le câble USB marche sans aucun réseau ni internet, et même sans carte SIM avec l'option E.",
    parts: [
      {
        title: "Chaque session",
        steps: [
          {
            title: "Lancer Navidrome sur le téléphone",
            body: "<p>Ouvrez Termux et laissez-le ouvert.</p>",
            code: "~/navidrome.sh",
            tip: "Pour vérifier qu'il tourne : ouvrez <code>http://localhost:4533</code> dans le navigateur du téléphone. Avec le widget (étape 8), un toucher suffit."
          },
          {
            title: "Relier le PC et le téléphone",
            body: "<p>Choisissez <b>une</b> façon, et notez l'adresse du téléphone :</p>",
            choices: [
              { label: "A · Même wifi", body: "<ol><li>PC et téléphone sur le même wifi (box).</li><li>Termux → <code>ifconfig</code> → ligne <code>inet</code>, par exemple <code>10.188.202.114</code> (ignorez <code>127.0.0.1</code> et <code>192.0.0.4</code>).</li><li>Adresse : <code>10.188.202.114:4533</code>.</li></ol>" },
              { label: "B · Partage de connexion de l'iPhone", body: "<ol><li>PC et téléphone connectés à l'iPhone.</li><li>Téléphone : Paramètres → Wi-Fi → ⚙️ → <b>Adresse IP</b> → celle qui contient <code>ff:fe</code> (ou une adresse courte <code>172.20.10.x</code>).</li><li>Adresse : collez-la telle quelle dans conductor. ; elle change quand l'iPhone change de réseau.</li></ol>" },
              { label: "C · Point d'accès du téléphone", body: "<ol><li>Téléphone : Paramètres → Connexions → <b>Point d'accès mobile</b> → activer.</li><li>PC : se connecter à ce point d'accès.</li><li>PC : <code>ipconfig</code> → <b>Passerelle par défaut</b>, souvent <code>192.168.43.1</code>.</li><li>Adresse : <code>192.168.43.1:4533</code>.</li></ol>" },
              { label: "D · Câble USB (100 % hors ligne)", body: "<ol><li>Branchez le téléphone au PC avec un câble <b>de données</b> : le téléphone doit apparaître dans l'Explorateur Windows.</li><li>Téléphone : Paramètres → Connexions → Point d'accès mobile et modem → activez <b>Modem USB</b> (<i>USB tethering</i> en anglais). Le téléphone disparaît alors de l'Explorateur : c'est normal, le câble sert maintenant au réseau.</li><li>Coupez les <b>données mobiles</b> du téléphone (le câble continue de marcher). Windows affiche « Pas d'accès Internet » : c'est normal.</li><li>PC : touche Windows → « cmd » → <code>ipconfig /all</code> → la carte dont la <b>Description</b> est <b>« Remote NDIS based Internet Sharing Device »</b> (souvent « Ethernet 3 ») → <b>Passerelle par défaut</b>, par exemple <code>192.168.36.250</code>.</li><li>Adresse : <code>192.168.36.250:4533</code> (avec la vôtre).</li></ol><table class=\"mn-table\"><tr><th>Ligne de la carte « Remote NDIS »</th><th></th></tr><tr><td><b>Passerelle par défaut</b></td><td>le téléphone : <b>c'est celle-ci</b></td></tr><tr><td>Serveur DHCP, Serveurs DNS</td><td>souvent la même adresse, mais pas toujours : ne vous y fiez pas</td></tr><tr><td>Adresse IPv4</td><td>le PC, pas le téléphone : à ne pas prendre</td></tr></table><p><b>L'adresse change à chaque branchement</b> (le nombre du milieu est tiré au hasard) : si le site ne trouve plus le téléphone, refaites l'étape 4. Pour une adresse fixe, prenez l'option E.</p><p>« Modem USB » grisé ou absent (possible <b>sans carte SIM</b> sur certains Samsung) ? Option E.</p><p><b>Plus simple :</b> le raccourci <code>conductor-usb</code> du bureau trouve l'adresse et la donne à conductor. pour vous (étape 7).</p>" },
              { label: "E · Câble USB sans carte SIM (ADB)", body: "<p>Le câble transporte Navidrome directement, sans partage de connexion : ni SIM, ni wifi, ni données mobiles.</p><p><b>Une seule fois :</b></p><ol><li>Téléphone : Paramètres → À propos du téléphone → Informations sur le logiciel → touchez <b>7 fois</b> « Numéro de version » (les <b>Options de développement</b> apparaissent).</li><li>Paramètres → Options de développement → activez <b>Débogage USB</b>.</li><li>PC : téléchargez les <b>SDK Platform-Tools</b> pour Windows (site developer.android.com, gratuit) et décompressez le dossier dans <code>C:\\platform-tools</code>.</li><li>Branchez le câble <b>de données</b>, puis dans l'Invite de commandes : <code>C:\\platform-tools\\adb devices</code>. Sur le téléphone, acceptez « Autoriser le débogage USB » (cochez « Toujours autoriser »). La commande doit afficher une ligne terminée par <code>device</code>.</li></ol><p><b>À chaque branchement du câble :</b></p><ol><li>Invite de commandes : <code>C:\\platform-tools\\adb forward tcp:4533 tcp:4533</code></li><li>Adresse : <code>localhost:4533</code> (à ajouter une seule fois dans conductor.).</li></ol>" }
            ]
          },
          {
            title: "Tester dans Chrome",
            body: "<p>Ouvrez <code>http://ADRESSE:4533</code> (avec votre adresse). La page de connexion Navidrome s'affiche ? Le lien marche.</p>",
            tip: "Adresse IPv6 : entre crochets, <code>http://[2a04:…]:4533</code>."
          },
          {
            title: "Donner l'adresse à conductor.",
            body: "<p>conductor. → <b>audio-files</b> → « Adresses du téléphone » : tapez l'adresse → <b>Ajouter</b>. Elle est testée puis gardée avec les autres.</p><p>Les fois suivantes, rien à faire : conductor. essaie les adresses connues et prend celle qui répond (bouton <b>Détecter</b> pour forcer un essai).</p>",
            tip: "Jamais connecté ? Remplissez plutôt le formulaire de connexion (adresse, utilisateur, mot de passe Navidrome)."
          },
          {
            title: "Écouter",
            body: "<p>Lancez un album relié au téléphone (page de l'album, ▶ sur une pochette, file d'attente). Si le réseau change pendant l'écoute, conductor. bascule sur l'adresse qui répond et reprend au même endroit.</p>"
          },
          {
            title: "Fin de session",
            body: "<p>Termux → <b>Ctrl</b> + <b>C</b> (ou widget <b>conductor-stop</b>). Coupez le point d'accès (C) ou le Modem USB (D) si besoin. Avec E, débrancher le câble suffit.</p>",
            tip: "Branchez le téléphone pendant les longues écoutes : le serveur l'empêche de se mettre en veille."
          }
        ]
      },
      {
        title: "Raccourcis (une seule fois, facultatif)",
        steps: [
          {
            title: "PC : le raccourci « câble USB »",
            body: "<p>Le dossier <code>app\\tools</code> contient <code>conductor-usb.bat</code>. Mettez-le où vous voulez le lancer (bureau ou menu Démarrer, ci-dessous).</p><p>Ensuite, à chaque session : câble branché, <b>Modem USB</b> activé, double-clic sur le raccourci. Il :</p><ul><li>trouve l'adresse du téléphone sur le câble (carte « Remote NDIS ») — ou, avec l'option E, lance les <code>adb forward</code> (ports 4533 et 8022) et prend <code>localhost</code> ;</li><li>copie l'adresse (à coller dans WinSCP) ;</li><li>ouvre conductor. avec cette adresse : testée, utilisée, et les anciennes adresses du câble sont retirées.</li></ul><p>Plus besoin d'<code>ipconfig</code>.</p>",
            choices: [
              { label: "Sur le bureau", body: "<p>Clic droit sur <code>conductor-usb.bat</code> → <b>Afficher plus d'options</b> si besoin → <b>Envoyer vers</b> → <b>Bureau (créer un raccourci)</b>.</p>" },
              { label: "Dans le menu Démarrer", body: "<p>Windows ne permet pas toujours d'épingler directement un <code>.bat</code> : on passe par un raccourci.</p><ol><li>Clic droit sur <code>conductor-usb.bat</code> → <b>Afficher plus d'options</b> si besoin → <b>Créer un raccourci</b>.</li><li><kbd>Win</kbd> + <kbd>R</kbd>, tapez <code>shell:programs</code>, <kbd>Entrée</kbd> : le dossier des programmes du menu Démarrer s'ouvre.</li><li>Copiez ou déplacez le raccourci dans ce dossier (renommez-le <code>conductor USB</code> si vous voulez).</li></ol><p>Il apparaît dans la liste des applications du menu Démarrer : tapez son nom pour le trouver.</p><p><b>L'épingler comme une application :</b> menu Démarrer → tapez son nom → clic droit → <b>Épingler au menu Démarrer</b> (ou <b>Épingler à la barre des tâches</b>).</p>" }
            ],
            tip: "Linux : <code>tools/conductor-usb.sh</code>, ajouté au menu des applications par <code>install-linux.sh</code> (guide « conductor. sous Linux »). Il ouvre Chrome (sinon Edge). Pour forcer Edge : ouvrez <code>conductor-usb.ps1</code> dans le Bloc-notes et mettez <code>$Browser = \"msedge\"</code>. Une fenêtre bleue s'affiche quelques secondes : c'est normal."
          },
          {
            title: "Téléphone : un widget pour tout lancer",
            body: "<ol><li>Dans <b>F-Droid</b>, installez <b>Termux:Widget</b> (même source que Termux).</li><li>Dans Termux, collez ce bloc (crée deux raccourcis) :</li></ol>",
            code: "mkdir -p ~/.shortcuts\ncat > ~/.shortcuts/conductor <<'EOF'\n#!/data/data/com.termux/files/usr/bin/bash\n# conductor. : serveur d'envoi (WinSCP) + Navidrome\ncommand -v sshd >/dev/null && { pgrep -x sshd >/dev/null || sshd; }\nif pgrep -x navidrome >/dev/null; then\n  echo \"Navidrome tourne déjà.\"; sleep 2\nelse\n  exec ~/navidrome.sh\nfi\nEOF\ncat > ~/.shortcuts/conductor-stop <<'EOF'\n#!/data/data/com.termux/files/usr/bin/bash\npkill -x navidrome; pkill -x sshd; termux-wake-unlock\necho \"Navidrome et l'envoi sont arrêtés.\"; sleep 2\nEOF\nchmod 700 ~/.shortcuts ~/.shortcuts/*",
            tip: "Puis : appui long sur l'écran d'accueil → <b>Widgets</b> → <b>Termux:Widget</b> → posez-le. Il affiche <b>conductor</b> (lance le serveur d'envoi et Navidrome) et <b>conductor-stop</b> (arrête tout). Si rien ne s'ouvre au toucher : Paramètres → Applications → Termux → <b>Apparaître au-dessus</b> → autoriser."
          }
        ]
      }
    ],
    trouble: [
      ["Rien ne s'affiche à l'étape 3", "Sur le téléphone, ouvrez <code>http://localhost:4533</code> : rien → Navidrome ne tourne pas (regardez Termux) ; ça s'affiche → c'est le réseau."],
      ["A · le wifi bloque", "Fréquent en résidence : les appareils ne se voient pas. Passez en C ou D."],
      ["B · iPhone, l'adresse IPv6 ne répond pas", "iPhone → Réglages → Partage de connexion → <b>Maximiser la compatibilité</b>. Toujours rien : passez en C ou D."],
      ["D · « Modem USB » grisé", "Câble de charge seule (le téléphone n'apparaît pas dans l'Explorateur), ou téléphone pas encore reconnu : autre câble, rebranchez, choisissez « Transfert de fichiers »."],
      ["D · Pas de carte « Remote NDIS » dans <code>ipconfig</code>", "« Modem USB » n'est pas activé (bouton bleu), ou le câble ne transporte pas de données. La carte « VirtualBox Host-Only » (<code>192.168.56.1</code>) n'a rien à voir."],
      ["D · « Le téléphone ne répond pas à cette adresse »", "Navidrome tourne-t-il ? L'adresse a pu changer depuis le dernier branchement : <code>ipconfig</code> → passerelle de la carte « Remote NDIS »."],
      ["D · menu « Point d'accès mobile et modem » grisé sans carte SIM", "Certains Samsung le bloquent sans SIM. Insérez une SIM quelconque (même sans forfait), ou passez en E."],
      ["E · <code>adb devices</code> n'affiche rien", "Câble de charge seule, débogage USB pas activé, ou pilote manquant : installez le <b>Samsung USB Driver</b> (site Samsung), puis rebranchez."],
      ["E · <code>unauthorized</code> après le nom du téléphone", "Déverrouillez le téléphone et acceptez « Autoriser le débogage USB »."],
      ["E · <code>localhost:4533</code> ne répond plus", "Le câble a été débranché ou le PC redémarré : relancez la commande <code>adb forward</code>."],
      ["Nouvelle musique sur le téléphone", "Navidrome la voit seul en quelques minutes, puis audio-files → <b>Actualiser</b>."],
      ["Raccourci USB : « Aucun téléphone sur le câble »", "Modem USB pas activé (bouton bleu) ou câble de charge seule. Option E : débogage USB activé et <code>adb.exe</code> dans <code>C:\\platform-tools</code>."],
      ["Raccourci USB : « Navidrome ne répond pas encore »", "Lancez Navidrome (widget <b>conductor</b> ou <code>~/navidrome.sh</code>), puis relancez le raccourci ou cliquez <b>Détecter</b> dans audio-files."],
      ["Widget : « conductor » absent ou rien ne se passe", "Refaites le bloc de l'étape 8 (le <code>chmod 700</code> est indispensable) ; Termux et Termux:Widget doivent venir tous deux de F-Droid ; autorisez Termux à « Apparaître au-dessus »."]
    ]
  },

  {
    id: "envoyer-musique",
    title: "Envoyer de la musique vers le téléphone",
    short: "Copier des dossiers d'albums du PC vers le téléphone avec WinSCP, par le câble USB, sans couper l'écoute.",
    icon: "upload",
    time: "10 min la première fois, puis 1 min",
    intro: "Navidrome ne sait pas recevoir de fichiers : on passe par un petit serveur SFTP dans Termux et le logiciel WinSCP sur le PC (sous Linux, le gestionnaire de fichiers suffit : guide « conductor. sous Linux »). Les dossiers entiers glissent comme dans l'Explorateur, par le câble USB (ou le wifi), pendant que Navidrome tourne.",
    parts: [
      {
        title: "Une seule fois",
        steps: [
          {
            title: "Installer le serveur SFTP dans Termux",
            body: "<p>Dans Termux, répondez <code>y</code> si on vous le demande :</p>",
            code: "pkg install openssh"
          },
          {
            title: "Choisir un mot de passe",
            body: "<p>Tapez-le deux fois. Rien ne s'affiche pendant la frappe : c'est normal.</p>",
            code: "passwd"
          },
          {
            title: "Noter votre nom d'utilisateur",
            body: "<p>La réponse ressemble à <code>u0_a123</code> : c'est l'utilisateur à donner à WinSCP.</p>",
            code: "whoami"
          },
          {
            title: "Autoriser l'accès aux fichiers",
            body: "<p>Déjà fait pour Navidrome ? Passez. Sinon, lancez la commande et acceptez l'autorisation sur le téléphone.</p>",
            code: "termux-setup-storage"
          },
          {
            title: "Installer WinSCP sur le PC",
            body: "<p>Téléchargez <b>WinSCP</b> sur <code>winscp.net</code> (gratuit) et installez-le.</p>"
          }
        ]
      },
      {
        title: "À chaque envoi",
        steps: [
          {
            title: "Relier le PC et le téléphone",
            body: "<p>Comme pour écouter : câble USB + <b>Modem USB</b>, puis <code>ipconfig /all</code> → carte « Remote NDIS… » → <b>Passerelle par défaut</b> (ex. <code>192.168.36.250</code>). Détails : guide « Écouter les fichiers du téléphone », option D.</p>",
            tip: "Le raccourci <code>conductor-usb</code> du bureau (guide « Écouter les fichiers du téléphone », étape 7) trouve l'adresse et la <b>copie</b> : collez-la dans WinSCP. Avec l'option E (ADB), il prépare aussi le port 8022 ; l'adresse est alors <code>localhost</code>."
          },
          {
            title: "Lancer le serveur",
            body: "<p>Dans Termux. Rien ne s'affiche : il tourne en arrière-plan. Navidrome peut tourner en même temps : lancez <code>sshd</code> avant, ou ouvrez une nouvelle session Termux (glisser depuis le bord gauche → <b>New session</b>).</p><p>Avec le widget <b>conductor</b> (guide « Écouter les fichiers du téléphone », étape 8), c'est déjà fait.</p>",
            code: "sshd"
          },
          {
            title: "Se connecter avec WinSCP",
            body: "<p>WinSCP → <b>Nouvelle session</b> :</p><table class=\"mn-table\"><tr><td>Protocole</td><td><b>SFTP</b></td></tr><tr><td>Nom d'hôte</td><td>l'adresse du jour, ex. <code>192.168.36.250</code> (sans <code>:4533</code>)</td></tr><tr><td>Port</td><td><b>8022</b></td></tr><tr><td>Utilisateur</td><td>celui de <code>whoami</code></td></tr><tr><td>Mot de passe</td><td>celui de <code>passwd</code></td></tr></table><p><b>Connexion</b>. La première fois, acceptez la clé du serveur (<b>Oui</b>). <b>Enregistrer</b> garde ces réglages : la prochaine fois, seule l'adresse est à changer.</p>",
            tip: "Avec l'adresse de la carte « Remote NDIS », tout passe par le câble, même si le wifi du PC est allumé."
          },
          {
            title: "Aller dans le dossier musique",
            body: "<p>Volet de droite (le téléphone) : tapez le chemin dans sa barre d'adresse, <code>/storage/emulated/0/</code> suivi du dossier que lit Navidrome. Carte SD : <code>/storage/1A2B-3C4D/Music</code> (le nom vu avec <code>ls /storage</code>).</p>",
            code: "/storage/emulated/0/Music"
          },
          {
            title: "Envoyer",
            body: "<p>Faites glisser vos dossiers d'albums du volet de gauche (le PC) vers celui de droite, puis confirmez. Les sous-dossiers suivent.</p><p>Un fichier <code>.lrc</code> à côté d'un morceau, avec le même nom, donne ses paroles synchronisées au karaoké.</p>"
          },
          {
            title: "Voir les albums dans conductor.",
            body: "<p>Navidrome détecte la nouvelle musique seul en quelques minutes (sinon : lancez un scan dans son interface, <code>http://adresse:4533</code>). Puis conductor. → <b>audio-files</b> → <b>Actualiser</b>.</p>"
          },
          {
            title: "Arrêter le serveur",
            body: "<p>Quand c'est fini (ou fermez simplement Termux).</p>",
            code: "pkill sshd"
          }
        ]
      }
    ],
    trouble: [
      ["« Connexion refusée »", "<code>sshd</code> n'est pas lancé, ou le port n'est pas <b>8022</b>."],
      ["« Délai dépassé » / « Expiration »", "L'adresse a changé depuis le dernier branchement : <code>ipconfig /all</code> → passerelle de la carte « Remote NDIS »."],
      ["« Accès refusé » au mot de passe", "Mauvais utilisateur (<code>whoami</code>) ou mot de passe : refaites <code>passwd</code>."],
      ["« Permission refusée » dans le dossier", "Refaites <code>termux-setup-storage</code> et acceptez l'autorisation sur le téléphone."],
      ["Sans WinSCP, sans rien installer", "Désactivez <b>Modem USB</b> : le téléphone revient dans l'Explorateur Windows, copiez-y vos dossiers, puis réactivez <b>Modem USB</b> (nouvelle adresse à relever)."]
    ]
  },

  {
    id: "youtube-conductor",
    title: "De YouTube à conductor. : le parcours complet",
    short: "Télécharger un album (yt-dlp), corriger ses tags (TagScanner), l'envoyer sur le téléphone (WinSCP), l'écouter par le câble USB.",
    icon: "route",
    time: "20 min la première fois, puis 5 min par lot d'albums",
    intro: "YouTube → yt-dlp (script de téléchargement) → TagScanner (tags) → WinSCP (envoi) → Navidrome (serveur sur le téléphone) → câble USB → conductor. Chaque maillon a son guide ; celui-ci les met bout à bout. Sous Linux : telecharger_albums.sh, Kid3 et sftp:// (guide « conductor. sous Linux »). En pratique, on lance Navidrome et on branche le câble juste avant l'envoi : WinSCP passe par le même câble.",
    parts: [
      {
        title: "Une seule fois (PC)",
        steps: [
          {
            title: "Installer yt-dlp et ffmpeg",
            body: "<p>Dans PowerShell (ou l'Invite de commandes), puis <b>fermez et rouvrez</b> la fenêtre pour qu'ils soient trouvés :</p>",
            code: "winget install yt-dlp.yt-dlp\nwinget install Gyan.FFmpeg",
            tip: "Vérifiez avec <code>yt-dlp --version</code> et <code>ffmpeg -version</code>. yt-dlp se met à jour avec <code>yt-dlp -U</code> (ou <code>winget upgrade yt-dlp.yt-dlp</code>) : à faire si YouTube refuse un jour les téléchargements."
          },
          {
            title: "Installer TagScanner",
            body: "<p>Gratuit, sur <code>xdlab.ru</code>. Il corrige les tags de plusieurs fichiers d'un coup (artiste, album, année, numéros, pochette) : indispensable après YouTube, dont les tags sont approximatifs.</p>"
          },
          {
            title: "WinSCP, Navidrome, raccourcis",
            body: "<p>Déjà faits si vous avez suivi les guides <b>Envoyer de la musique vers le téléphone</b> et <b>Écouter les fichiers du téléphone</b> (raccourci <code>conductor-usb</code>, widget Termux).</p>"
          }
        ]
      },
      {
        title: "Pour chaque lot d'albums",
        steps: [
          {
            title: "YouTube : trouver l'album",
            body: "<p>Cherchez la <b>playlist de l'album</b>, idéalement celle d'une chaîne « <i>Artiste</i> - Topic » ou de YouTube Music (pistes officielles, dans l'ordre, sans clip ni intro). Copiez son adresse (<code>…playlist?list=…</code>).</p>"
          },
          {
            title: "Ajouter l'album au script",
            body: "<p>Ouvrez <code>app\\tools\\telecharger_albums.ps1</code> dans le Bloc-notes. Dans <code>$Albums</code>, une ligne par album :</p>",
            code: "@{ Nom = \"Artiste - Album (1971)\"; Url = \"https://youtube.com/playlist?list=…\" }",
            tip: "<b>Nom</b> = le dossier créé : « Artiste - Album (Année) », sans <code>? / \\ : * \" &lt; &gt; |</code> (remplacez-les ou retirez-les). Enregistrez en gardant l'encodage (UTF-8)."
          },
          {
            title: "yt-dlp : télécharger",
            body: "<p>Dans PowerShell, depuis le dossier <code>tools</code>. <code>-Destination</code> est facultatif (par défaut : <code>tools\\Albums</code>).</p>",
            code: "cd D:\\GOLF\\conductor\\app\\tools\npowershell -ExecutionPolicy Bypass -File .\\telecharger_albums.ps1 -Destination \"D:\\Musique\\Albums\"",
            tip: "MP3 meilleure qualité, pochette et tags intégrés, une piste par fichier <code>001 - Titre.mp3</code>. Coupure ou erreur ? Relancez : les pistes déjà téléchargées sont sautées."
          },
          {
            title: "TagScanner : corriger les tags",
            body: "<p>Les tags venus de YouTube sont à reprendre (artiste = nom de la chaîne, album = nom de la playlist, pas d'année). Dans TagScanner, ouvrez le dossier de l'album, onglet <b>Tag Editor</b> (Éditeur de tags) :</p><ol><li>Sélectionnez <b>toutes</b> les pistes de l'album.</li><li>Remplissez pour toutes à la fois : <b>Artist</b>, <b>Album Artist</b> (sans « feat. »), <b>Album</b>, <b>Year</b>, <b>Genre</b> si vous voulez.</li><li><b>Track #</b> : déjà rempli par le script ; sinon onglet <b>Tag Processor</b> → <i>Filename → Tag</i> avec le modèle <code>%track% - %title%</code>.</li><li>Titres : retirez ce qui traîne (« (Official Audio) », « - Remastered »…).</li><li><b>Cover</b> : la pochette intégrée vient de YouTube (souvent la miniature) ; remplacez-la par une vraie pochette carrée si besoin.</li><li><b>Save</b>.</li></ol>",
            tip: "Navidrome ne regroupe un album que si <b>toutes</b> ses pistes ont le même <b>Album</b>, le même <b>Album Artist</b> et la même <b>année</b> (guide « Installer Navidrome », Bien taguer vos fichiers)."
          },
          {
            title: "Navidrome : le serveur",
            body: "<p>Sur le téléphone : widget <b>conductor</b> (ou <code>~/navidrome.sh</code> dans Termux). Il lance aussi le serveur d'envoi pour WinSCP. Navidrome voit les nouveaux albums en quelques minutes.</p>"
          },
          {
            title: "Réseau USB",
            body: "<p>Câble branché, <b>Modem USB</b> activé, double-clic sur le raccourci <b>conductor-usb</b> : il trouve l'adresse du téléphone, la <b>copie</b> (pour WinSCP) et ouvre conductor. avec.</p>"
          },
          {
            title: "WinSCP : envoyer sur le téléphone",
            body: "<p>Connexion SFTP (collez l'adresse copiée, port 8022), puis glissez les dossiers d'albums vers le dossier musique du téléphone (guide <b>Envoyer de la musique vers le téléphone</b>). Un <code>.lrc</code> de même nom qu'une piste lui donne ses paroles synchronisées.</p>"
          },
          {
            title: "conductor. : ajouter et écouter",
            body: "<p><b>audio-files</b> → <b>Actualiser</b> → section « sur le téléphone, pas encore dans la collection » : ajoutez les nouveaux albums (collection ou next up). Leur page joue directement les fichiers du téléphone.</p>"
          }
        ]
      }
    ],
    trouble: [
      ["« 'yt-dlp' n'est pas installé ou introuvable »", "Installez-le (étape 1), puis fermez et rouvrez PowerShell. Même chose pour ffmpeg."],
      ["« l'exécution de scripts est désactivée »", "Lancez-le avec <code>powershell -ExecutionPolicy Bypass -File .\\telecharger_albums.ps1</code>."],
      ["yt-dlp : erreur « Sign in » ou « HTTP Error 403 »", "Mettez yt-dlp à jour : <code>yt-dlp -U</code>, puis relancez (les pistes déjà là sont sautées)."],
      ["Accents bizarres dans les noms", "Le script doit rester enregistré en UTF-8 : dans le Bloc-notes, <b>Enregistrer sous</b> → Encodage <b>UTF-8 avec BOM</b>."],
      ["L'album est coupé en plusieurs dans Navidrome", "Une piste a un Album, un Album Artist ou une année différente : corrigez-la dans TagScanner, renvoyez-la (WinSCP remplace le fichier)."]
    ]
  },

  {
    id: "linux",
    title: "conductor. sous Linux",
    short: "Chrome ou Chromium, raccourcis du menu des applications, câble USB, envoi en sftp://, yt-dlp et Kid3 : les équivalents Linux.",
    icon: "linux",
    time: "10 min, une seule fois",
    intro: "Le site marche pareil sous Linux : c'est une page ouverte dans le navigateur. Seuls les outils autour changent : scripts .sh au lieu de .bat / .ps1, ip route au lieu d'ipconfig, gestionnaire de fichiers au lieu de WinSCP. Commandes pour Ubuntu / Debian (apt), Fedora (dnf), Arch (pacman).",
    parts: [
      {
        title: "Installer",
        steps: [
          {
            title: "Chrome, Chromium ou Edge",
            body: "<p>Firefox ne sait pas écrire dans <code>datastorage</code> : prenez <b>Google Chrome</b>, <b>Chromium</b> ou <b>Edge</b>.</p>",
            tip: "Chromium en <b>snap</b> (Ubuntu) ou <b>Flatpak</b> : gardez <code>conductor/</code> dans votre dossier personnel. Sur un disque externe avec le snap : <code>sudo snap connect chromium:removable-media</code>."
          },
          {
            title: "Raccourcis du menu des applications",
            body: "<p>Une seule fois, dans un terminal. Rend les scripts exécutables et ajoute <b>conductor.</b> et <b>conductor USB</b> au menu des applications (et <b>conductor USB</b> sur le bureau).</p>",
            code: "bash ~/conductor/app/tools/install-linux.sh",
            tip: "Adaptez le chemin si <code>conductor/</code> est ailleurs. GNOME : si le raccourci du bureau ne se lance pas, clic droit → <b>Autoriser le lancement</b>."
          },
          {
            title: "Ouvrir et autoriser datastorage",
            body: "<p>Menu des applications → <b>conductor.</b>, puis en bas à gauche : <b>Choisir le dossier datastorage</b> → <code>conductor/datastorage</code>. Touches multimédia et commandes de lecture du bureau marchent comme sous Windows.</p>"
          }
        ]
      },
      {
        title: "Téléphone par câble USB",
        steps: [
          {
            title: "Le raccourci conductor USB",
            body: "<p>Câble branché, <b>Modem USB</b> activé, widget <b>conductor</b> touché : lancez <b>conductor USB</b>. Il trouve l'adresse du téléphone, la copie (si <code>wl-copy</code>, <code>xclip</code> ou <code>xsel</code> est installé) et ouvre conductor. avec. NetworkManager connecte le câble tout seul.</p>"
          },
          {
            title: "Ou trouver l'adresse à la main",
            body: "<p>La passerelle de l'interface USB (<code>usb0</code> ou <code>enx…</code>) est l'adresse du téléphone : <code>default via 192.168.36.250 dev enx…</code> → <code>192.168.36.250:4533</code>.</p>",
            code: "ip -4 route | grep -E 'dev (usb|enx|rndis)'"
          },
          {
            title: "Option E (ADB), sans Modem USB",
            body: "<p>Installez adb (Fedora : <code>sudo dnf install android-tools</code> ; Arch : <code>sudo pacman -S android-tools</code>), branchez, <code>adb devices</code> et acceptez sur le téléphone. Le raccourci <b>conductor USB</b> fait ensuite les <code>adb forward</code> (4533 et 8022) et prend <code>localhost</code>.</p>",
            code: "sudo apt install adb",
            tip: "<code>no permissions</code> : <code>sudo apt install android-sdk-platform-tools-common</code>, débranchez, rebranchez."
          }
        ]
      },
      {
        title: "Envoyer de la musique",
        steps: [
          {
            title: "Gestionnaire de fichiers en sftp://",
            body: "<p>Le téléphone fait tourner <code>sshd</code> (widget <b>conductor</b>). Pas besoin de WinSCP : Fichiers / Nautilus → <b>Autres emplacements</b> → <b>Connexion à un serveur</b> (Dolphin : barre d'adresse), avec l'adresse du jour et l'utilisateur de <code>whoami</code>. Glissez vos dossiers d'albums.</p>",
            code: "sftp://u0_a123@192.168.36.250:8022/storage/emulated/0/Music",
            tip: "Aussi : FileZilla (hôte <code>sftp://adresse</code>, port 8022), ou en terminal <code>scp -P 8022 -r \"Albums/Artiste - Album (1971)\" u0_a123@adresse:/storage/emulated/0/Music/</code>."
          }
        ]
      },
      {
        title: "De YouTube à conductor.",
        steps: [
          {
            title: "yt-dlp et ffmpeg",
            body: "<p>yt-dlp par <code>pipx</code> (les paquets des distributions sont souvent trop vieux ; mise à jour : <code>pipx upgrade yt-dlp</code>), ffmpeg par le gestionnaire de paquets.</p>",
            code: "sudo apt install pipx ffmpeg\npipx install yt-dlp"
          },
          {
            title: "Le script de téléchargement",
            body: "<p><code>tools/telecharger_albums.sh</code> fait comme la version Windows. Les albums sont dans le tableau <code>ALBUMS</code>, une ligne <code>\"Nom|adresse de la playlist\"</code> par album.</p>",
            code: "cd ~/conductor/app/tools\n./telecharger_albums.sh ~/Musique/Albums"
          },
          {
            title: "Les tags : Kid3",
            body: "<p>TagScanner n'existe que pour Windows (il marche sous Wine). Équivalent natif : <b>Kid3</b> (<code>sudo apt install kid3-qt</code>, ou Flatpak), ou MusicBrainz Picard. Dans Kid3 : sélectionnez toutes les pistes, remplissez Artist, Album Artist, Album, Date ; numéros depuis le nom de fichier : bouton <b>From Filename</b>, format <code>%{track} - %{title}</code> ; enregistrez.</p>"
          }
        ]
      }
    ],
    trouble: [
      ["<code>Permission non accordée</code> en lançant un .sh", "<code>bash tools/install-linux.sh</code> (ou <code>chmod +x tools/*.sh</code>)."],
      ["<code>bad interpreter: /bin/bash^M</code>", "Fichier passé par Windows en fins de ligne CRLF : <code>sed -i 's/\\r$//' tools/*.sh</code>."],
      ["datastorage refusé sur un disque externe", "Chromium snap : <code>sudo snap connect chromium:removable-media</code>, ou déplacez <code>conductor/</code> dans votre dossier personnel."],
      ["Aucun téléphone sur le câble", "Modem USB activé ? <code>ip -4 route</code> montre-t-il une ligne <code>usb…</code> / <code>enx…</code> ? Câble de données ?"]
    ]
  },

  {
    id: "telecommande",
    title: "Télécommande : piloter conductor. depuis un téléphone",
    short: "iPhone ou Android, en wifi ou en 4G : pochette, lecture / pause, titres, ★, volumes, gestes. Un relais sur le PC, aucune appli à installer sur le téléphone.",
    icon: "remote",
    time: "15 min la première fois, puis un double-clic",
    intro: "Un petit relais tourne sur le PC (Node.js) : le téléphone ouvre sa page dans le navigateur et pilote conductor. Même réseau (wifi, point d'accès, partage de connexion) : rien de plus. En 4G ou sur un autre wifi : Tailscale relie le téléphone au PC, sans changer de réseau. Le téléphone qui pilote n'a pas besoin d'être celui qui contient la musique.",
    parts: [
      {
        title: "Une seule fois (PC)",
        steps: [
          {
            title: "Installer Node.js",
            body: "<p>Dans PowerShell, puis fermez et rouvrez la fenêtre. Linux : <code>sudo apt install nodejs</code> (version 18 ou plus).</p>",
            code: "winget install OpenJS.NodeJS.LTS"
          },
          {
            title: "Le bouton « Démarrer la télécommande »",
            body: "<p>Double-clic sur <code>app\\tools\\remote\\install-button.bat</code>, une fois. Le bouton de conductor. (icône téléphone du pied de page) lance alors le relais, sans fenêtre. Le script propose aussi de le lancer à chaque démarrage de Windows : plus rien à faire ensuite. Linux : <code>install-linux.sh</code> le fait.</p><p>Sans le bouton : <code>start-remote.bat</code> lance le relais dans une fenêtre (à laisser ouverte).</p>",
            tip: "Au premier lancement, Windows demande d'autoriser Node.js sur le réseau : cochez <b>réseaux privés</b> et <b>réseaux publics</b> (le wifi de la résidence est souvent « public »), puis <b>Autoriser</b>. Au premier clic sur le bouton, Chrome demande d'ouvrir « conductor-remote » : cochez <b>Toujours autoriser</b>."
          }
        ]
      },
      {
        title: "En 4G ou sur un autre wifi : Tailscale",
        steps: [
          {
            title: "Pourquoi",
            body: "<p>En 4G, le téléphone n'est pas sur le réseau du PC ; et beaucoup de wifis de résidence empêchent les appareils de se voir. <b>Tailscale</b> (gratuit pour un usage personnel) crée un réseau privé entre vos appareils : le téléphone joint le PC où qu'il soit, connexion directe et chiffrée, le PC n'est pas exposé sur internet. Le téléphone garde son internet normal.</p>"
          },
          {
            title: "Installer sur le PC et le téléphone",
            body: "<ol><li>PC : installez Tailscale, ouvrez-le et connectez-vous (compte Google, Microsoft ou Apple).</li><li>Téléphone : appli <b>Tailscale</b> (App Store ou Play Store), <b>même compte</b>, activez-la.</li><li>Le relais affiche alors une adresse <code>http://100.…:8765</code> marquée « Tailscale ».</li></ol>",
            code: "winget install tailscale.tailscale",
            tip: "Sur l'iPhone, Tailscale apparaît comme un VPN : laissez-le activé (il ne fait passer que le trafic vers vos appareils)."
          }
        ]
      },
      {
        title: "Appairer le téléphone (une fois par téléphone)",
        steps: [
          {
            title: "Scanner le QR code",
            body: "<p>conductor. → icône <b>téléphone</b> du pied de page → <b>Démarrer la télécommande</b> si besoin : un <b>QR code</b> s'affiche. Visez-le avec l'<b>appareil photo</b> du téléphone et touchez le lien : la télécommande s'ouvre, déjà appairée. Plusieurs réseaux ? Choisissez l'onglet (Wifi, Tailscale…) avant de scanner.</p>",
            tip: "Sans appareil photo : tapez l'adresse affichée sous le QR code, puis le code à 4 chiffres. Le code et le QR code ne changent pas d'une fois sur l'autre (« Nouveau code » les renouvelle et oublie les téléphones)."
          },
          {
            title: "En faire une appli sur le téléphone",
            body: "<p>Juste après le scan, dans Safari : <b>Partager</b> → <b>Sur l'écran d'accueil</b> (Android, Chrome : <b>⋮</b> → <b>Ajouter à l'écran d'accueil</b>). L'icône conductor. s'ouvre ensuite en plein écran, comme une appli, et retrouve le PC toute seule.</p>",
            tip: "L'icône garde l'adresse du PC. Si elle change (wifi de résidence qui redonne une autre adresse), rescannez le QR code et refaites l'icône. Avec Tailscale, l'adresse ne change pas."
          }
        ]
      },
      {
        title: "Piloter",
        steps: [
          {
            title: "Les commandes",
            body: "<table class=\"mn-table\"><tr><th>Geste / bouton</th><th>Effet</th></tr><tr><td>⏯ ⏮ ⏭</td><td>lecture / pause, titre précédent / suivant</td></tr><tr><td>★</td><td>morceau préféré</td></tr><tr><td>glisser ← → sur la pochette</td><td>titre suivant / précédent</td></tr><tr><td>glisser ↑ ↓ sur la pochette</td><td>volume de l'appli (un cran tous les 2 cm environ)</td></tr><tr><td>réglette <b>APPLI</b></td><td>volume de conductor., sur 20</td></tr><tr><td>réglette <b>PC</b></td><td>volume de Windows (ou de Linux)</td></tr></table><p>Tout est synchronisé dans les deux sens : un changement sur le PC s'affiche aussitôt sur le téléphone. Le point vert en haut indique que le PC répond.</p>"
          },
          {
            title: "Au quotidien",
            body: "<p>PC : conductor. (relais lancé au démarrage de Windows, ou bouton <b>Démarrer la télécommande</b>). Téléphone : l'icône de l'écran d'accueil (Tailscale activé en 4G). Le QR code ne sert qu'à appairer un <b>nouveau</b> téléphone. Pour arrêter le relais : icône téléphone → <b>Arrêter le relais</b>.</p>"
          }
        ]
      }
    ],
    trouble: [
      ["La page ne s'ouvre pas sur le téléphone", "Le relais tourne-t-il (fenêtre ouverte) ? Bonne adresse ? Pare-feu : autorisez Node.js (réseaux privés et publics). Wifi de résidence : passez par l'adresse Tailscale."],
      ["« conductor. fermé sur le PC »", "Le relais tourne mais conductor. n'est pas ouvert : ouvrez-le (il se relie tout seul en quelques secondes)."],
      ["« Démarrer la télécommande » ne fait rien", "Lancez une fois <code>install-button.bat</code> ; Node.js doit être installé. Le détail des erreurs est dans <code>tools/remote/relay-errors.log</code>."],
      ["« Code incorrect » ou « QR code périmé »", "Le code a été renouvelé (« Nouveau code ») : scannez le QR code affiché maintenant. 5 erreurs : attente de 30 secondes."],
      ["Pas de réglette PC", "Le volume de l'ordinateur n'a pas pu être lu. Windows : rien à installer, relancez le relais. Linux : installez <code>pulseaudio-utils</code> (pactl) ou <code>alsa-utils</code>."],
      ["« Port 8765 déjà utilisé »", "Le relais tourne déjà dans une autre fenêtre : gardez-en une seule."],
      ["Changer de téléphone, ou en retirer un", "Sur le téléphone : icône en haut à droite (oublier ce PC). Pour tous les retirer : supprimez <code>tools/remote/.remote-tokens.json</code> sur le PC."]
    ]
  },

  // ===================================================================
  {
    id: "calage-paroles",
    title: "Caler des paroles pour le karaoké",
    short: "Quand un morceau n'a pas de paroles synchronisées : Entrée au début de chaque ligne, enregistré pour toujours.",
    icon: "karaoke",
    time: "La durée du morceau, une seule fois",
    intro: "Le karaoké allume chaque ligne au moment où elle est chantée. Quand aucune source ne connaît ces moments, vous les lui apprenez : c'est le calage. Un seul passage par morceau suffit, le résultat est gardé et marche hors ligne.",
    parts: [
      {
        title: "Préparer",
        steps: [
          {
            title: "Ouvrir le karaoké",
            body: "<p>Lancez le morceau, passez en plein écran avec <kbd>P</kbd>, puis affichez les paroles avec <kbd>K</kbd> (ou le bouton micro en haut à droite).</p>"
          },
          {
            title: "Lire le pied du panneau des paroles",
            body: "<table class=\"mn-table\"><tr><th>Vous voyez</th><th>À faire</th></tr><tr><td><code>paroles : LRCLIB</code> (ou autre source)</td><td>Rien : déjà synchronisées. Une faute ou une ligne décalée : <b>modifier</b> (étape 8). Tout à refaire : <b>recaler</b>.</td></tr><tr><td><code>paroles non synchronisées</code></td><td><b>caler les paroles</b>, puis l'étape 5.</td></tr><tr><td><code>Pas de paroles trouvées</code></td><td><b>coller des paroles</b>, étape 4.</td></tr></table><p><b>Vous avez déjà le fichier <code>.lrc</code> ?</b> Rien à caler : bouton <b>importer .lrc</b> (ou <b>coller</b> son contenu). Voir l'étape 3.</p>",
            tip: "Pour que le calage soit enregistré, le dossier <code>datastorage</code> doit être autorisé (bandeau en bas à gauche)."
          },
          {
            title: "Vous avez le fichier .lrc : l'importer",
            body: "<p>Un <code>.lrc</code> contient déjà les temps (<code>[00:12.40]Karma police</code>) : pas besoin de caler.</p><ul><li><b>importer .lrc</b> (en bas du panneau des paroles) → choisissez le fichier : les paroles s'affichent tout de suite, synchronisées.</li><li>Ou ouvrez le <code>.lrc</code> dans le Bloc-notes, copiez tout, cliquez <b>coller</b> (ou <b>coller des paroles</b>) et collez : conductor. reconnaît les temps, le bouton devient <b>utiliser ces paroles</b>.</li></ul><p>Pas de .lrc ? Bouton <b>Lyricsify ↗</b> : une recherche de l'artiste et du titre sur lyricsify.com s'ouvre dans un nouvel onglet ; téléchargez le .lrc, puis <b>importer .lrc</b>.</p><p>La version importée remplace celle d'avant (LRCLIB, calage…), source « fichier .lrc importé ». Un décalage ? <b>modifier</b> → <b>tout décaler</b>.</p>",
            tip: "Les morceaux du téléphone peuvent aussi avoir leur .lrc à côté du fichier audio, avec le même nom : Navidrome le transmet (relancez un scan après l'avoir ajouté). Mais si le karaoké a déjà des paroles enregistrées pour ce morceau, elles passent avant : importez plutôt."
          },
          {
            title: "S'il n'y a pas de paroles : les coller",
            body: "<ol><li>Cliquez <b>coller des paroles</b>.</li><li>Collez le texte (Genius, livret…).</li><li><b>Une ligne = une phrase chantée</b> : coupez les lignes trop longues, écrivez le refrain autant de fois qu'il est chanté. Les intertitres <code>[Refrain]</code> sont ignorés.</li><li>Cliquez <b>caler ces paroles</b>.</li></ol><p>Les paroles collées sont aussi gardées pour la page de l'album.</p>"
          }
        ]
      },
      {
        title: "Caler",
        steps: [
          {
            title: "Entrée au début de chaque ligne",
            body: "<p>Le morceau repart du début. La prochaine ligne à caler est marquée <b>▸</b>. Appuyez sur <kbd>Entrée</kbd> au moment où elle <b>commence</b> à être chantée. Arrivé à la dernière, c'est terminé et enregistré.</p><table class=\"mn-table\"><tr><th>Touche</th><th>Pendant le calage</th></tr><tr><td><kbd>Entrée</kbd></td><td>la ligne ▸ commence maintenant</td></tr><tr><td><kbd>⌫</kbd></td><td>annule la dernière ligne et revient un peu avant</td></tr><tr><td><kbd>Espace</kbd></td><td>pause / reprise</td></tr><tr><td><kbd>Échap</kbd></td><td>abandonne, sans rien enregistrer</td></tr></table>"
          },
          {
            title: "Les bons réflexes",
            body: "<ul><li><b>Appuyez sur la première syllabe</b>, pas avant : 0,15 s est déjà retiré pour votre temps de réaction.</li><li><b>Une erreur ?</b> <kbd>⌫</kbd> tout de suite, et refaites la ligne.</li><li><b>Passage instrumental</b> : attendez simplement la ligne suivante. Outro sans paroles : <b>terminer</b>.</li><li><b>Rap rapide</b> : <kbd>Espace</kbd> avant le couplet pour vous préparer.</li><li><b>Quelques lignes ratées ?</b> Finissez, puis corrigez-les avec <b>modifier</b> : inutile de tout refaire.</li></ul>"
          },
          {
            title: "Après le calage",
            body: "<p>Les paroles s'affichent tout de suite en karaoké (« calées à la main »). Elles sont enregistrées dans <code>datastorage/lyrics-synced/&lt;album&gt;/&lt;titre&gt;.lrc</code> et resservent sans internet, d'où que vienne le fichier audio.</p>"
          }
        ]
      },
      {
        title: "Retoucher",
        steps: [
          {
            title: "Corriger dans le karaoké : modifier",
            body: "<p>Paroles synchronisées affichées, cliquez <b>modifier</b> en bas du panneau. Chaque ligne apparaît avec son temps ; la ligne en cours de lecture reste surlignée.</p><table class=\"mn-table\"><tr><th>Dans la liste</th><th>Effet</th></tr><tr><td>le texte</td><td>se corrige directement, le temps ne bouge pas (<kbd>Entrée</kbd> ou <kbd>↑</kbd> <kbd>↓</kbd> : ligne suivante / précédente ; ligne vide = pause ♪)</td></tr><tr><td><code>00:15.85</code></td><td>réécouter à partir de cette ligne</td></tr><tr><td><b>−</b> / <b>+</b></td><td>la ligne commence 0,1 s plus tôt / plus tard</td></tr><tr><td><b>⏱</b></td><td>la ligne commence maintenant (position de lecture)</td></tr><tr><td><b>↵</b> / <b>×</b></td><td>insérer une ligne en dessous / supprimer la ligne</td></tr><tr><td><b>tout décaler</b></td><td>±0,1 s ou ±0,5 s sur toutes les lignes</td></tr></table><p><b>enregistrer</b> garde la nouvelle version (source « modifiées à la main ») ; <kbd>Espace</kbd> : lecture / pause ; <kbd>Échap</kbd> ou <b>annuler</b> : rien n'est changé.</p>",
            tip: "Pour une ligne mal calée : cliquez son temps pour réécouter, puis <b>⏱</b> pile quand elle commence. Plus rapide que des dizaines de clics sur + / −."
          },
          {
            title: "Ou modifier le fichier .lrc (facultatif)",
            body: "<p>Un <code>.lrc</code> est un simple texte (Bloc-notes). Chaque ligne commence par son temps <code>[minutes:secondes.centièmes]</code>. Pour avancer une ligne d'une demi-seconde, retirez <code>0.50</code> à son temps. Pour tout décaler, ajoutez <code>[offset:+300]</code> en haut (0,3 s plus tôt ; <code>-300</code> : plus tard).</p>",
            code: "[ti:Karma Police]\n[by:calage manuel]\n[00:12.40]Karma police\n[00:15.85]Arrest this man\n[00:18.10]He talks in maths",
            tip: "Enregistrez, puis rechargez le site (F5) : la nouvelle version est prise au prochain passage du karaoké sur ce morceau."
          }
        ]
      }
    ],
    trouble: [
      ["Une faute dans les paroles", "<b>modifier</b>, corrigez le texte de la ligne, <b>enregistrer</b> : les temps restent en place."],
      ["Le calage n'est pas gardé", "Le dossier <code>datastorage</code> n'est pas autorisé : bandeau en bas à gauche du site."],
      ["Les lignes s'allument trop tôt / trop tard", "<b>modifier</b> puis <b>tout décaler</b> ; quelques lignes seulement : <b>−</b> / <b>+</b> ou <b>⏱</b> sur ces lignes."]
    ]
  },

  // ===================================================================
  {
    id: "tiers",
    title: "Guide des tiers",
    short: "S, A, B : ce que veut dire chaque tier et comment choisir pour un album.",
    icon: "tier",
    time: "1 min par album",
    intro: "Le tier se choisit sur la page de l'album, sous l'intensité. Un seul par album ; recliquer le retire. Dans la collection, le filtre Tier montre un tier à la fois.",
    parts: [
      {
        title: "Choisir le tier d'un album",
        steps: [
          {
            title: "S — Masterpiece (few reach here)",
            body: "<p>L'élite absolue, un album exceptionnel. Un album qui frôle la perfection (nah, qui <b>touche</b> la perfection) et se démarque par sa direction artistique, sa cohérence, sa production ou son impact émotionnel.</p><ul><li>Aucun morceau faible.</li><li>Every element feels intentional and contributes to the overall experience.</li></ul><p><b>Exemple de jugement :</b> un de tes albums préférés de tous les temps.</p>",
            tip: "Le tier S doit rester rare. Si tu y places trop d'albums, il perd son caractère exceptionnel."
          },
          {
            title: "A — Excellent work (la plupart des albums de ma collection devraient être ici)",
            body: "<p>Outstanding quality, with a strong artistic identity and excellent execution. Delivers a consistently great experience from start to finish.</p><p>Un album de très grande qualité, avec une véritable personnalité artistique, très bien exécuté.</p><ul><li>A clear artistic vision, executed to a high standard.</li><li>Memorable tracks and a consistently rewarding listening experience.</li></ul><p><b>Exemple de jugement :</b> un album que tu recommandes sans hésiter.</p>"
          },
          {
            title: "B — Very good job",
            body: "<p>Solid albums that do what they set out to do, and do it very well. They may not push boundaries or reinvent the genre, but they deliver an effective, enjoyable and well-executed experience.</p><p>Un album solide : on ne réinvente pas la roue, on fait un truc très efficace.</p><ul><li>A solid tracklist with some standout moments.</li><li>Good execution, even if the album lacks originality or ambition.</li><li>Enjoyable overall, but not quite exceptional.</li></ul><p><b>Exemple de jugement :</b> un album que tu apprécies, sans le considérer comme incontournable.</p>"
          }
        ]
      }
    ],
    summary: [["S", "Masterpiece", "très peu d'albums"], ["A", "Excellent work", "la plupart des albums"], ["B", "Very good job", "les albums solides"]]
  }
];
