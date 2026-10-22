# Soma NPT : analyse du produit de référence

Analyse réalisée le 2026-10-22, à partir de sources publiques uniquement. Le site soma-npt.ch est chargé en JavaScript et n'expose que ses titres de pages. Les détails viennent du centre d'aide public Intercom (https://intercom.help/soma-technologies/en/), de la fiche App Store et de la presse.

Légende : **[O]** observé dans une source, **[I]** inféré, **[U]** inconnu.

## 1. Produit et cible

- **[O]** Soma NPT (Neuro Performance Technology) est co-développé par Walter Staiano. Samuele Marcora est à l'origine du concept de BET et des protocoles initiaux. Source : https://www.outsideonline.com/health/training-performance/brain-endurance-training-apps
- **[O]** C'est un produit **B2B** pour coachs, clubs et organisations (sportifs pros, armée, universités) : les athlètes utilisent l'appli, et les coachs suivent les résultats dans « Soma Analytics ». Source : https://apps.apple.com/app/id1333946625
- **[O]** Définition du BET chez Soma : coupler tâches cognitives et entraînement physique pour « rester lucide sous la fatigue ». Selon Staiano, c'est plus efficace juste après un entraînement dur ; à froid, le bénéfice est faible.
- **[O]** Science citée :
  - l'étude de Staiano et Marcora sur des cyclistes (les chiffres « 126 % contre 42 % » rapportés par la presse sont probablement erronés) ;
  - 2 essais randomisés (RCT) publiés dans J Sci Med Sport en 2023 : https://www.tour-magazin.de/fitness/gesundheit/brain-endurance-training-denksport-fuer-mehr-ausdauer/
  - un RCT sur l'entraînement en résistance, avec un Stroop de 30 min : https://rdpc.uevora.pt/bitstream/10174/38035/1/brain_endurance_training_improves_and_maintains.498.pdf
  - pour le PVT : Dinges & Powell 1985, Basner et al. 2011 (PVT-B).
- **[U]** Aucune validation indépendante trouvée pour le modèle de charge ni pour le PFTT. La plupart des preuves viennent des laboratoires des fondateurs.

## 2. Structure

- **[O]** Trois composants :
  - l'appli athlète, sur **iOS uniquement** (et visionOS) ;
  - le tableau de bord coach, sur le web ;
  - « Soma Intelligence », une analyse par IA accessible via un connecteur MCP pour Claude et un générateur de plans basé sur ChatGPT.
- **[O]** Comptes : un « Soma ID » à 6 chiffres par personne, relié au compte du coach.
- **[O]** Organisation : un Plan contient des Séances, et chaque séance enchaîne des drills (tâche + mode + durée + intensité %), avec des bilans avant et après.
- **[O]** Catalogue de **74 tâches** :
  - 55 tactiles : PVT/PVT-B, Stroop et variantes, flanker, Go/No-Go, stop signal, n-back, MSIT, AX-CPT, PASAT, Posner, task switching…
  - 4 par accéléromètre : on penche le téléphone pour répondre ;
  - 15 vocales : on répond à voix haute.
  - Source : https://intercom.help/soma-technologies/en/articles/10449325-cognitive-tasks-available-inside-soma-npt
- **[O]** Durées :
  - une tâche standard dure environ 3 min ;
  - PVT-B : 3 min ; PVT : 5 ou 10 min ;
  - l'échauffement « Prime » dure environ 12 min (4 tâches de 3 min) ;
  - le bilan dure environ 30 min ;
  - les séances augmentent d'environ 5 min par semaine, jusqu'à 45 min.
- **[O]** Placement par rapport au sport, avec 4 options :
  - avant l'entraînement ;
  - intercalé : des tâches de 3 min pendant la récupération entre deux séries ;
  - simultané, pendant le cardio, uniquement hors saison ;
  - **après l'entraînement**, l'option recommandée par défaut.
  - Source : https://intercom.help/soma-technologies/en/articles/14734912-monitor-integrate-prime-build

## 3. Personnalisation et progression

- **[O]** 15 **modes** se superposent à n'importe quelle tâche (https://intercom.help/soma-technologies/en/articles/14708659-the-full-modes-list) :
  - adaptatif : la difficulté s'ajuste en direct selon le temps de réaction, la précision et leur variation ;
  - pression temporelle : la fenêtre pour répondre rétrécit ;
  - jusqu'à l'épuisement : la tâche s'arrête quand on est 20 % plus lent qu'au départ ;
  - conséquence : chaque erreur ajoute 15 s ;
  - modes liés au rythme cardiaque, avec une ceinture Polar H10 ;
  - et d'autres.
- **[O]** Progression par blocs (https://intercom.help/soma-technologies/en/articles/14717531-how-to-assess-and-progress-a-training-plan) :
  - un bilan avant et après chaque bloc ;
  - une « demande » devient un **point fort** seulement si le temps de réaction, la régularité **et** la précision progressent chacun d'au moins 5 % ;
  - le bloc suivant donne aux points faibles 2 à 3 fois plus de place qu'aux points forts.
- **[O]** Périodisation (https://intercom.help/soma-technologies/en/articles/10548401-how-to-periodize-a-plan) :
  - surcharge progressive sur 4 semaines, avec environ +10 % d'intensité, +5 min, ou +1 séance par semaine ;
  - **une seule variable modifiée par semaine** ;
  - on ne juge une tendance qu'après au moins 9 séances.
- **[O]** Ajustement selon la fatigue, mesurée par le PVT-B (https://intercom.help/soma-technologies/en/articles/11155382-how-to-monitor-mental-fatigue-in-soma-analytics) :
  - 0 à 3 lapses avant et 1 à 5 après : on garde le plan ;
  - plus de 5 lapses après : on baisse la charge ;
  - des résultats plats : on monte la charge.
- **[O]** Échelles subjectives :
  - la fatigue mentale ressentie, après chaque tâche ;
  - le VAS-F, 7 items notés avant, pendant et après la séance.
- **[I]** En dehors des modes adaptatifs, **la progression est réglée par le coach**. Un avis App Store de 2024 se plaint qu'il n'y a « aucun système de progression » pour les utilisateurs seuls.

## 4. Métriques suivies

- **[O]** Indicateurs (https://intercom.help/soma-technologies/en/articles/14707245-understanding-the-metrics) :
  - temps de réaction (ms) ;
  - précision (%) ;
  - variation (coefficient de variation, %) ;
  - Rate Correct Score : bonnes réponses par seconde ;
  - vitesse : 1000 / temps de réaction ;
  - lapses : 500 ms ou plus pour le PVT, 355 ms ou plus pour le PVT-B, exclus du temps moyen (https://intercom.help/soma-technologies/en/articles/14057357-pvt-and-pvt-b-reaction-time-cutoffs-and-lapses) ;
  - variabilité cardiaque (HRV).
- **[O]** Vues :
  - moyenne ou **minute par minute**, qui fait apparaître la « minute de décrochage » ;
  - tendances et comparaison au bilan de départ ;
  - courbe du questionnaire VAS-F ;
  - calendrier.

## 5. Prix

- **[O]** 49 CHF par mois et par athlète, 299 CHF par mois pour Soma Analytics (https://intercom.help/soma-technologies/en/articles/6007150-pricing). Sur l'App Store : 49,99 $ par mois.
- **[O]** Note App Store d'environ 2,8/5 (11 avis). Les reproches portent sur le prix, affiché seulement après le téléchargement, et sur le manque d'accompagnement.

## 6. Ce que BETTraining en retient

- **Repris** :
  - la mesure de fatigue par PVT-B de 3 min (lapse à 355 ms ou plus) en ouverture et en clôture de séance ;
  - des exercices d'environ 3 min ;
  - la règle des 5 % sur 3 indicateurs pour classer points forts et points faibles ;
  - la proportion 2:1 en faveur des points faibles ;
  - une seule variable de charge modifiée par semaine ;
  - le contexte « après le sport » par défaut ;
  - la courbe minute par minute ;
  - la fatigue mentale ressentie.
- **Ce qui nous différencie** :
  - une progression **automatique** pour un utilisateur seul, alors que Soma dépend du coach ;
  - le web responsive (ordinateur et mobile) ;
  - plus tard, les intégrations Strava et Garmin.
- **Risques** :
  - la précision du chronométrage dans le navigateur : utiliser `performance.now()`, afficher les stimuli en phase avec l'image (requestAnimationFrame) et enregistrer l'appareil utilisé ;
  - des preuves scientifiques surtout produites par les fondateurs : ne pas promettre d'effets.
