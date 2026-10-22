# BETTraining

Application web d'entraînement cérébral centrée sur le Brain Endurance Training, qui propose des séances personnalisées et un suivi de progression complet.

## Entraînement

**Brain Endurance Training (BET)**:
Entraînement qui soumet le cerveau à un effort cognitif prolongé et exigeant pour augmenter sa résistance à la fatigue mentale. C'est le cœur du produit.
_Avoid_: brain training, jeux cérébraux

**Capacité cognitive** (_Cognitive domain_):
Une fonction mentale entraînée et mesurée séparément. Les quatre capacités actuelles sont l'attention soutenue, la mémoire de travail, la vitesse de traitement et l'inhibition.
_Avoid_: compétence, skill, catégorie

**Attention soutenue**:
Capacité à rester concentré et vigilant sur une tâche pendant une longue durée.
_Avoid_: concentration, focus

**Mémoire de travail**:
Capacité à garder des informations en tête et à les manipuler sur un court instant.
_Avoid_: mémoire (seul), mémoire à court terme

**Vitesse de traitement**:
Rapidité avec laquelle une information simple est perçue et traitée.
_Avoid_: réflexes, rapidité

**Inhibition**:
Capacité à retenir une réponse automatique ou à ignorer une distraction.
_Avoid_: contrôle (seul), self-control

**Exercice** (_Exercise_):
Un type de tâche cognitive (par exemple n-back ou Stroop) qui entraîne une ou plusieurs capacités cognitives.
_Avoid_: jeu, game, mini-jeu, task

**Séance** (_Session_):
Un enchaînement d'exercices réalisé d'une traite.
_Avoid_: workout, partie, entraînement (seul)

**Séance du jour** (_Daily session_):
La séance générée chaque jour par l'algorithme à partir du niveau et de l'historique de l'utilisateur : une séance BET ou une séance légère.
_Avoid_: programme, plan du jour

**Séance BET** (_BET session_):
Une séance du jour complète : mesure de fatigue, bloc ciblé, bloc BET, puis mesure de fatigue. Elle est proposée 3 à 5 fois par semaine.
_Avoid_: grosse séance, séance complète

**Séance légère** (_Light session_):
Une séance du jour courte, sans bloc BET, proposée les jours sans séance BET.
_Avoid_: séance de récupération, séance bonus

**Entraînement cognitif** (_Cognitive training_):
Une séance faite au repos, sans activité physique associée. Elle entraîne les capacités cognitives mais ne compte pas comme du BET.
_Avoid_: BET au repos

**Entraînement libre** (_Free practice_):
Pratique d'un exercice choisi par l'utilisateur, en dehors de la séance du jour.
_Avoid_: mode libre, sandbox

**Bloc BET** (_BET block_):
La partie centrale d'une séance du jour : un ou deux exercices longs et exigeants destinés à provoquer de la fatigue mentale.
_Avoid_: bloc principal, cœur de séance

**Bloc ciblé** (_Targeted block_):
La partie d'une séance du jour, faite avant le bloc BET, composée d'exercices courts qui portent surtout sur les points faibles.
_Avoid_: bloc faiblesses, bonus

**Contexte de séance** (_Session context_):
Le moment de la séance par rapport à l'activité physique : au repos, avant le sport ou après le sport.
_Avoid_: placement, situation

## Mesure

**Difficulté** (_Difficulty_):
Le réglage d'un exercice pour un utilisateur, qui s'ajuste pendant l'exercice selon ses réussites et ses erreurs.
_Avoid_: niveau, intensité

**Niveau** (_Level_):
Le score d'un utilisateur sur une capacité cognitive, calculé à partir de ses performances récentes.
_Avoid_: difficulté, rang, score (seul)

**Bilan** (_Assessment_):
Une série standardisée et toujours identique, passée pendant la semaine allégée. Elle mesure chaque capacité cognitive à froid, puis de nouveau après un bloc BET standard.
_Avoid_: test, évaluation, baseline

**Résistance à la fatigue** (_Fatigue resistance_):
L'écart entre les résultats d'un bilan à froid et en état fatigué. C'est l'indicateur principal du BET.
_Avoid_: endurance mentale, endurance cognitive

**Semaine allégée** (_Deload week_):
Une semaine de charge réduite, toutes les 4 semaines, pendant laquelle on passe le bilan.
_Avoid_: semaine de repos, décharge

**Mesure de fatigue** (_Fatigue check_):
Un PVT-B de 3 minutes passé au début et à la fin de chaque séance du jour pour mesurer la fatigue mentale de façon objective.
_Avoid_: test de fatigue, PVT (seul)

**Lapse**:
Une réponse trop lente lors d'une mesure de fatigue, signe d'une baisse de vigilance.
_Avoid_: raté, erreur

**Fatigue mentale ressentie** (_Perceived mental fatigue_):
L'auto-évaluation par l'utilisateur de sa fatigue mentale, sur une échelle de 0 à 10.
_Avoid_: fatigue (seul), RMF

**Essai** (_Trial_):
Un stimulus présenté pendant un exercice et la réponse de l'utilisateur, la plus petite unité de mesure enregistrée.
_Avoid_: question, tour, item

**Point fort** (_Strength_):
Une capacité cognitive dont le temps de réaction, la régularité et la précision progressent chacun d'au moins 5 % entre deux bilans.
_Avoid_: acquis, capacité maîtrisée

**Point faible** (_Weakness_):
Une capacité cognitive qui n'est pas un point fort.
_Avoid_: lacune, faiblesse

**Charge** (_Load_):
La quantité d'effort cognitif prévue par l'algorithme pour une séance. Elle monte d'un palier toutes les 2 semaines, en modifiant une seule variable à la fois.
_Avoid_: intensité, volume

**Charge réalisée** (_Session load_):
L'effort qu'une séance a réellement demandé, calculé à partir de l'effort perçu et de la durée. Elle sert à repérer le surmenage.
_Avoid_: charge (seul), TRIMP

**Effort perçu** (_Perceived effort_):
L'auto-évaluation par l'utilisateur de la difficulté de la séance qu'il vient de terminer, sur une échelle de 0 à 10.
_Avoid_: RPE, intensité ressentie

**Motivation ressentie** (_Perceived motivation_):
L'auto-évaluation, de 0 à 10 en fin de séance, de la motivation ou de l'ennui de l'utilisateur, à distinguer de sa fatigue mentale.
_Avoid_: humeur, engagement
