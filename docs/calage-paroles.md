# Guide du calage des paroles

Le karaoké de conductor. affiche les paroles **synchronisées** : chaque ligne s'allume au moment où elle est chantée.
Pour ça, il faut savoir *quand* commence chaque ligne. Quand aucune source ne le sait, c'est vous qui le
lui apprenez : c'est le **calage**. Un seul passage par morceau suffit, le résultat est gardé pour toujours.

---

## 1. Avant de commencer

Le karaoké cherche d'abord tout seul, dans cet ordre :

1. les paroles déjà enregistrées (trouvées avant, ou calées par vous) ;
2. un fichier `.lrc` à côté du morceau, ou les paroles intégrées au fichier (stockage local) ;
3. les paroles intégrées à vos fichiers sur Navidrome ;
4. **LRCLIB**, la base de paroles en ligne (il faut internet).

Vous n'avez donc à caler que les morceaux pour lesquels rien n'a été trouvé. Le pied du panneau des paroles vous le dit :

| Ce que vous voyez | Ce que ça veut dire | Bouton proposé |
|---|---|---|
| `paroles : LRCLIB` (ou autre source) | déjà synchronisées, rien à faire | **modifier** (faute, ligne décalée), **recaler** (tout refaire) |
| `paroles non synchronisées · …` | le texte existe, pas les temps | **caler les paroles** |
| `Pas de paroles trouvées` | rien du tout | **coller des paroles** |

> Pour que le calage soit **enregistré**, le dossier `datastorage` doit être autorisé (bandeau en bas à
> gauche du site). Sinon, il ne dure que le temps de la session.

---

## 2. Ouvrir le karaoké

1. Lancez le morceau.
2. Passez en plein écran : touche **P** (ou le bouton ⤢ du mini-lecteur).
3. Affichez les paroles : touche **K** (ou le bouton micro en haut à droite).

---

## 3. Si le morceau n'a pas de paroles : les coller

1. Cliquez **coller des paroles**.
2. Collez le texte dans la zone qui s'ouvre (depuis Genius, le livret, etc.).
3. Vérifiez la mise en forme : **une ligne = une phrase chantée**.
   - Coupez les lignes trop longues en deux : une ligne doit pouvoir s'allumer d'un coup.
   - Les intertitres entre crochets (`[Refrain]`, `[Couplet 2]`) sont ignorés : vous pouvez les laisser.
   - Un refrain chanté trois fois doit être écrit trois fois.
4. Cliquez **caler ces paroles**.

Les paroles collées sont aussi gardées pour la page de l'album (source « vous »).

---

## 4. Caler

Le morceau repart du début et la lecture démarre. La **prochaine ligne à caler** est marquée d'un **▸**.

**Appuyez sur Entrée au moment où cette ligne commence à être chantée.** La ligne passe en « faite », la suivante prend le ▸. Continuez jusqu'à la dernière : le calage se termine et s'enregistre tout seul.

### Les touches

| Touche | Pendant le calage |
|---|---|
| **Entrée** | la ligne marquée ▸ commence maintenant |
| **⌫** (retour arrière) | annule la dernière ligne calée et revient un peu avant, pour la refaire |
| **Espace** | pause / reprise (pour souffler, ou vous préparer avant un passage rapide) |
| **Échap** | abandonne le calage, sans rien enregistrer (vous restez en plein écran) |

Boutons en bas du panneau : **terminer** (enregistre ce qui est déjà calé) et **abandonner**.

---

## 5. Conseils pour un calage précis

- **Appuyez sur la première syllabe**, pas avant. conductor. retire déjà 0,15 s pour compenser votre temps de réaction, et allume la ligne une fraction de seconde en avance pendant le karaoké.
- **Écoutez une fois avant** si vous ne connaissez pas bien le morceau : on anticipe mieux.
- **Gardez le rythme avec le doigt** posé sur Entrée, l'autre main près de ⌫.
- **Une erreur ?** Appuyez sur ⌫ tout de suite : la lecture revient juste avant la ligne précédente, vous la refaites.
- **Passage instrumental long** : rien de spécial à faire, attendez simplement la ligne suivante. Pour un *outro* sans paroles, cliquez **terminer** après la dernière ligne chantée.
- **Débit rapide (rap)** : faites une pause (Espace) avant le couplet, ou coupez moins les lignes pour avoir moins de temps à marquer.
- **Quelques lignes ratées ?** Terminez le calage, puis corrigez-les avec **modifier** (partie 7) : inutile de tout refaire.
- **Tout est décalé de la même façon ?** **modifier**, puis **tout décaler**.

---

## 6. Après le calage

- Les paroles s'affichent tout de suite en mode karaoké, avec la source **« calées à la main »**.
- Elles sont enregistrées dans :

  ```
  datastorage/lyrics-synced/<album>/<titre>.lrc
  ```

  et resservent ensuite **sans internet**, même si le fichier audio vient d'ailleurs (carte SD, Navidrome, extrait).
- Pour corriger une faute ou quelques lignes : **modifier** (partie 7).
- Pour tout refaire : **recaler**.

---

## 7. Corriger dans le karaoké : modifier

Paroles synchronisées affichées (trouvées ou calées par vous), cliquez **modifier** en bas du panneau.
Chaque ligne s'affiche avec son temps ; la ligne en cours de lecture reste surlignée.

| Dans la liste | Effet |
|---|---|
| le texte | se corrige directement, **le temps ne bouge pas** |
| `00:15.85` (le temps) | réécoute à partir de cette ligne |
| **−** / **+** | la ligne commence 0,1 s plus tôt / plus tard (sans dépasser ses voisines) |
| **⏱** | la ligne commence maintenant (position de lecture) |
| **↵** | insère une ligne en dessous |
| **×** | supprime la ligne |
| **tout décaler** (en haut) | ±0,1 s ou ±0,5 s sur toutes les lignes |

| Touche | Pendant la modification |
|---|---|
| **Entrée**, **↑** / **↓** | ligne suivante / précédente (dans le texte) |
| **Espace** | lecture / pause (hors du texte) |
| **Échap** | annule, rien n'est changé |

Une ligne laissée vide devient une pause instrumentale (♪).

**enregistrer** : le karaoké utilise tout de suite la nouvelle version (source « modifiées à la main »), gardée
au même endroit que le calage. Les paroles simples de la page album suivent, sauf si vous les avez écrites vous-même.
Changer de morceau pendant la modification enregistre ce qui a été changé.

> **Astuce** : pour une ligne mal calée, cliquez son temps pour réécouter juste avant, puis **⏱** pile quand
> elle commence.

---

## 8. Retoucher un fichier .lrc à la main (facultatif)

Un `.lrc` est un simple fichier texte, modifiable avec le Bloc-notes. Chaque ligne commence par son temps,
au format `[minutes:secondes.centièmes]` :

```
[ar:Radiohead]
[al:OK Computer]
[ti:Karma Police]
[by:calage manuel]
[00:12.40]Karma police
[00:15.85]Arrest this man
[00:18.10]He talks in maths
```

- Les premières lignes (`ar`, `al`, `ti`, `by`) donnent l'artiste, l'album, le titre et la source : elles ne s'affichent pas.
- Pour avancer une ligne d'une demi-seconde, retirez `0.50` à son temps (`[00:15.85]` → `[00:15.35]`).
- Pour tout décaler d'un coup, ajoutez une ligne `[offset:+300]` en haut : les paroles arrivent 0,3 s plus tôt (`-300` : plus tard).

Enregistrez, puis rechargez le site (**F5**) : la nouvelle version est prise en compte au prochain passage du karaoké sur ce morceau.

---

## 9. En résumé

1. **P** puis **K** sur le morceau.
2. **caler les paroles** (ou **coller des paroles**, puis **caler ces paroles**).
3. **Entrée** à chaque début de ligne, **⌫** pour corriger.
4. C'est enregistré, pour toujours. Une faute plus tard ? **modifier**.
