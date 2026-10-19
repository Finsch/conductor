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
              { label: "Sur la carte SD", body: "<p><code>ls /storage</code> : la carte apparaît sous un nom comme <code>1A2B-3C4D</code>. Le dossier sera <code>/storage/1A2B-3C4D/Music</code>.</p>" }
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
            body: "<p>Navidrome regroupe les pistes d'un album seulement si <b>toutes</b> ont le même <b>Album</b>, le même <b>Album Artist</b> (sans « feat. ») et la même <b>année</b>. Une seule piste différente coupe l'album en deux.</p><p>conductor. réunit ces morceaux (« réuni (18 + 1) » dans audio-files), mais corriger les tags rend tout propre partout.</p>"
          },
          {
            title: "Ce que conductor. lit aussi dans vos fichiers",
            body: "<ul><li><b>numéros de piste et de disque</b> : ordre et numérotation ;</li><li><b>pochette intégrée</b> ;</li><li><b>paroles intégrées</b> (USLT / LYRICS), simples ou synchronisées.</li></ul>"
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
            tip: "Pour vérifier qu'il tourne : ouvrez <code>http://localhost:4533</code> dans le navigateur du téléphone."
          },
          {
            title: "Relier le PC et le téléphone",
            body: "<p>Choisissez <b>une</b> façon, et notez l'adresse du téléphone :</p>",
            choices: [
              { label: "A · Même wifi", body: "<ol><li>PC et téléphone sur le même wifi (box).</li><li>Termux → <code>ifconfig</code> → ligne <code>inet</code>, par exemple <code>10.188.202.114</code> (ignorez <code>127.0.0.1</code> et <code>192.0.0.4</code>).</li><li>Adresse : <code>10.188.202.114:4533</code>.</li></ol>" },
              { label: "B · Partage de connexion de l'iPhone", body: "<ol><li>PC et téléphone connectés à l'iPhone.</li><li>Téléphone : Paramètres → Wi-Fi → ⚙️ → <b>Adresse IP</b> → celle qui contient <code>ff:fe</code> (ou une adresse courte <code>172.20.10.x</code>).</li><li>Adresse : collez-la telle quelle dans conductor. ; elle change quand l'iPhone change de réseau.</li></ol>" },
              { label: "C · Point d'accès du téléphone", body: "<ol><li>Téléphone : Paramètres → Connexions → <b>Point d'accès mobile</b> → activer.</li><li>PC : se connecter à ce point d'accès.</li><li>PC : <code>ipconfig</code> → <b>Passerelle par défaut</b>, souvent <code>192.168.43.1</code>.</li><li>Adresse : <code>192.168.43.1:4533</code>.</li></ol>" },
              { label: "D · Câble USB (100 % hors ligne)", body: "<ol><li>Branchez le téléphone au PC avec un câble <b>de données</b>.</li><li>Téléphone : Paramètres → Connexions → Point d'accès mobile et modem → <b>Modem USB</b>.</li><li>Coupez les <b>données mobiles</b> du téléphone (le câble continue de marcher). Windows affiche « Pas d'accès Internet » : c'est normal.</li><li>PC : touche Windows → « cmd » → <code>ipconfig</code> → carte <b>« Remote NDIS… »</b> → <b>Passerelle par défaut</b>, par exemple <code>192.168.42.129</code>.</li><li>Adresse : <code>192.168.42.129:4533</code>.</li></ol><p>« Modem USB » grisé ou absent (souvent <b>sans carte SIM</b> sur un Samsung) ? Prenez l'option E.</p>" },
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
            body: "<p>Termux → <b>Ctrl</b> + <b>C</b>. Coupez le point d'accès (C) ou le Modem USB (D) si besoin. Avec E, débrancher le câble suffit.</p>",
            tip: "Branchez le téléphone pendant les longues écoutes : le serveur l'empêche de se mettre en veille."
          }
        ]
      }
    ],
    trouble: [
      ["Rien ne s'affiche à l'étape 3", "Sur le téléphone, ouvrez <code>http://localhost:4533</code> : rien → Navidrome ne tourne pas (regardez Termux) ; ça s'affiche → c'est le réseau."],
      ["A · le wifi bloque", "Fréquent en résidence : les appareils ne se voient pas. Passez en C ou D."],
      ["B · iPhone, l'adresse IPv6 ne répond pas", "iPhone → Réglages → Partage de connexion → <b>Maximiser la compatibilité</b>. Toujours rien : passez en C ou D."],
      ["D · « Modem USB » grisé", "Câble de charge seule, ou téléphone pas encore reconnu : autre câble, rebranchez, choisissez « Transfert de fichiers »."],
      ["D · « Le téléphone ne répond pas à cette adresse »", "Navidrome tourne-t-il ? Bonne adresse (passerelle de la carte « Remote NDIS ») ?"],
      ["D · menu « Point d'accès mobile et modem » grisé sans carte SIM", "Certains Samsung le bloquent sans SIM. Insérez une SIM quelconque (même sans forfait), ou passez en E."],
      ["E · <code>adb devices</code> n'affiche rien", "Câble de charge seule, débogage USB pas activé, ou pilote manquant : installez le <b>Samsung USB Driver</b> (site Samsung), puis rebranchez."],
      ["E · <code>unauthorized</code> après le nom du téléphone", "Déverrouillez le téléphone et acceptez « Autoriser le débogage USB »."],
      ["E · <code>localhost:4533</code> ne répond plus", "Le câble a été débranché ou le PC redémarré : relancez la commande <code>adb forward</code>."],
      ["Nouvelle musique sur le téléphone", "Navidrome la voit seul en quelques minutes, puis audio-files → <b>Actualiser</b>."]
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
            body: "<table class=\"mn-table\"><tr><th>Vous voyez</th><th>À faire</th></tr><tr><td><code>paroles : LRCLIB</code> (ou autre source)</td><td>Rien : déjà synchronisées (<b>recaler</b> si elles sont décalées).</td></tr><tr><td><code>paroles non synchronisées</code></td><td><b>caler les paroles</b>, puis l'étape 4.</td></tr><tr><td><code>Pas de paroles trouvées</code></td><td><b>coller des paroles</b>, étape 3.</td></tr></table>",
            tip: "Pour que le calage soit enregistré, le dossier <code>datastorage</code> doit être autorisé (bandeau en bas à gauche)."
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
            body: "<ul><li><b>Appuyez sur la première syllabe</b>, pas avant : 0,15 s est déjà retiré pour votre temps de réaction.</li><li><b>Une erreur ?</b> <kbd>⌫</kbd> tout de suite, et refaites la ligne.</li><li><b>Passage instrumental</b> : attendez simplement la ligne suivante. Outro sans paroles : <b>terminer</b>.</li><li><b>Rap rapide</b> : <kbd>Espace</kbd> avant le couplet pour vous préparer.</li><li><b>Tout décalé ?</b> Recommencer (<b>recaler</b>) va souvent plus vite que corriger.</li></ul>"
          },
          {
            title: "Après le calage",
            body: "<p>Les paroles s'affichent tout de suite en karaoké (« calées à la main »). Elles sont enregistrées dans <code>datastorage/lyrics-synced/&lt;album&gt;/&lt;titre&gt;.lrc</code> et resservent sans internet, d'où que vienne le fichier audio.</p>"
          }
        ]
      },
      {
        title: "Retoucher à la main (facultatif)",
        steps: [
          {
            title: "Modifier le fichier .lrc",
            body: "<p>Un <code>.lrc</code> est un simple texte (Bloc-notes). Chaque ligne commence par son temps <code>[minutes:secondes.centièmes]</code>. Pour avancer une ligne d'une demi-seconde, retirez <code>0.50</code> à son temps. Pour tout décaler, ajoutez <code>[offset:+300]</code> en haut (0,3 s plus tôt ; <code>-300</code> : plus tard).</p>",
            code: "[ti:Karma Police]\n[by:calage manuel]\n[00:12.40]Karma police\n[00:15.85]Arrest this man\n[00:18.10]He talks in maths",
            tip: "Enregistrez, puis rechargez le site (F5) : la nouvelle version est prise au prochain passage du karaoké sur ce morceau."
          }
        ]
      }
    ],
    trouble: [
      ["Le calage n'est pas gardé", "Le dossier <code>datastorage</code> n'est pas autorisé : bandeau en bas à gauche du site."],
      ["Les lignes s'allument trop tôt / trop tard", "Recalez, ou ajoutez <code>[offset:…]</code> dans le .lrc (étape 7)."]
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
