# Next.js full-stack + PostgreSQL dans Docker, algorithme en TypeScript

BETTraining est un projet solo, utilisé d'abord par une seule personne. On a donc choisi une seule application Next.js qui gère à la fois l'interface et le backend (route handlers et server actions). Elle utilise PostgreSQL via l'ORM Drizzle, et le tout tourne dans `docker-compose`. L'algorithme de personnalisation est écrit en TypeScript dans l'application, derrière une interface isolée, pour pouvoir l'extraire plus tard vers un service Python si on fait du vrai machine learning.

## Considered Options

- **Backend séparé en NestJS** : on a écarté cette option, car elle ajoute un déploiement et un contrat d'API sans bénéfice pour un seul utilisateur.
- **Backend Python FastAPI** : on a écarté cette option pour l'instant. Elle n'est utile que si l'algorithme devient du machine learning, et on garderait alors l'extraction comme porte de sortie. La choisir dès maintenant obligerait à maintenir deux langages et deux applications.
