# somfy_TIC_9029425_homeassistant
Intégration du capteur de consommation connecté Somfy 9029425 dans homeassistant. (AI vibe coded)

- Appairer le capteur de consommation Somfy à votre homeassistant (via votre coordinateur zigbee)
- Créer un dossier external_converters à la base de votre répertoire homeassistant/zigbee2mqtt/
- Rédémarrer zigbee2mqtt via l'interface web dans l'onglet paramètres/outils
- Copiez le fichier "somfy_linky.js" dans le répertoire nouvellement créé /homeassistant/zigbee2mqtt/external_converters
- Rédémarrer zigbee2mqtt comme plus haut.
- Votre capteur de consommation devrait maintenant remonter toutes les bonnes informations; il n'y a plus qu'à rentrer les entités dans le tableau "énergie" de homeassistant
