# BudgetAI web

Application web : https://jlostanlen.github.io/budgetai/

Interface statique publiée sur GitHub Pages. Les comptes, budgets, relevés et analyses IA sont traités par le backend HTTPS existant, avec PostgreSQL et isolation par utilisateur. Aucun secret ni donnée personnelle ne doit être ajouté à ce dépôt.

La connexion depuis GitHub Pages utilise une session Bearer conservée dans sessionStorage pour cet onglet. La fermeture de l’onglet nécessite une nouvelle connexion. Le backend servi sur sa propre origine conserve ses cookies HttpOnly.

Les fichiers sont importés par une requête multipart authentifiée. Le téléchargement des originaux est également authentifié ; leur nom est conservé.

La branche main est publiée automatiquement par GitHub Pages. Assistance : support.html.
