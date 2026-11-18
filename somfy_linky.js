// Convertisseur externe Zigbee2MQTT — Somfy 9029425 "Capteur de consommation connecté" (Linky)
// v4 — ajoute l'exposition des index par tarif (energy_tier_1 à 4),
//      issus de currentSummDeliveredTier1..4 (cluster seMetering, en Wh).
//      Sur un contrat HP/HC, ce sont les index HP/HC (semaine) et HC/HP (week-end) :
//      identifier le mapping en observant quel compteur avance à quel moment.
// Historique des corrections :
//   - instantaneousDemand (seMetering) = source autoritaire de la puissance (W)
//     (totalActivePower figé sur cet appareil → ignoré)
//   - currentSummDelivered et les tiers en Wh → ÷ 1000 pour kWh
//   - valeurs "sentinelles" (0xFFFFFFFFFFFF) filtrées
//   - l'énergie est aussi renvoyée lors des rapports haElectricalMeasurement

const exposes = require('zigbee-herdsman-converters/lib/exposes');
const toZigbee = require('zigbee-herdsman-converters/converters/toZigbee');

const e = exposes.presets;
const ea = exposes.access;

// Seuil anti-sentinelles : toute valeur >= ~2^47 (0x800000000000) est "non disponible"
const SENTINEL_THRESHOLD = 1e14;
const isSentinel = (v) => v === undefined || v === null || Math.abs(v) >= SENTINEL_THRESHOLD;

let lastValues = {};

const definition = {
    zigbeeModel: ['SOMFY_LINKY', 'Linky Energy Sensor'],
    model: 'Linky Energy Sensor',
    vendor: 'Somfy',
    description: 'Capteur de consommation connecté (compteur Linky)',

    fromZigbee: [
        {
            cluster: 'haElectricalMeasurement',
            type: ['attributeReport'],
            convert: (model, msg, publish, options, meta) => {
                const attr = msg.data;

                if (!isSentinel(attr.rmsVoltage)) {
                    lastValues.voltage = attr.rmsVoltage;
                }
                if (!isSentinel(attr.rmsCurrent)) {
                    lastValues.current = attr.rmsCurrent;
                }

                // Puissance apparente totale (VA) — ou calculée U × I en secours
                if (!isSentinel(attr.totalApparentPower) && attr.totalApparentPower > 0) {
                    lastValues.power_apparent = attr.totalApparentPower;
                } else if (
                    lastValues.voltage !== undefined &&
                    lastValues.current !== undefined
                ) {
                    lastValues.power_apparent = lastValues.voltage * lastValues.current;
                }

                // NB : totalActivePower volontairement ignoré (figé sur cet appareil).

                // Renvoi du cache complet pour que energy et les tiers
                // restent présents même sans rapport seMetering récent.
                return {
                    voltage: lastValues.voltage,
                    current: lastValues.current,
                    power: lastValues.power,
                    power_apparent: lastValues.power_apparent,
                    energy: lastValues.energy,
                    energy_tier_1: lastValues.energy_tier_1,
                    energy_tier_2: lastValues.energy_tier_2,
                    energy_tier_3: lastValues.energy_tier_3,
                    energy_tier_4: lastValues.energy_tier_4,
                };
            },
        },
        {
            cluster: 'seMetering',
            type: ['attributeReport'],
            convert: (model, msg, publish, options, meta) => {
                const attr = msg.data;

                // Puissance instantanée — déjà en watts (source autoritaire)
                if (!isSentinel(attr.instantaneousDemand)) {
                    lastValues.power = attr.instantaneousDemand;
                }

                // Énergie cumulée totale (kWh) — currentSummDelivered en Wh ÷ 1000
                if (!isSentinel(attr.currentSummDelivered)) {
                    lastValues.energy = attr.currentSummDelivered / 1000;
                }

                // Index par tarif (kWh) — currentSummDeliveredTier1..4 en Wh ÷ 1000
                for (let tier = 1; tier <= 4; tier++) {
                    const val = attr[`currentSummDeliveredTier${tier}`];
                    if (!isSentinel(val)) {
                        lastValues[`energy_tier_${tier}`] = val / 1000;
                    }
                }

                return {
                    power: lastValues.power,
                    energy: lastValues.energy,
                    energy_tier_1: lastValues.energy_tier_1,
                    energy_tier_2: lastValues.energy_tier_2,
                    energy_tier_3: lastValues.energy_tier_3,
                    energy_tier_4: lastValues.energy_tier_4,
                };
            },
        },
    ],

    toZigbee: [toZigbee.factory_reset],

    exposes: [
        e.voltage().withAccess(ea.STATE),
        e.current().withAccess(ea.STATE),
        e.power().withAccess(ea.STATE),
        e.power_apparent().withAccess(ea.STATE),
        e.energy().withAccess(ea.STATE),
        // Index par tarif : HP/HC semaine et HC/HP week-end (mapping à confirmer par observation)
        exposes.numeric('energy_tier_1', ea.STATE)
            .withUnit('kWh')
            .withDescription('Index tarif 1 (HP ou HC — semaine ou week-end, à identifier)'),
        exposes.numeric('energy_tier_2', ea.STATE)
            .withUnit('kWh')
            .withDescription('Index tarif 2 (HP ou HC — semaine ou week-end, à identifier)'),
        exposes.numeric('energy_tier_3', ea.STATE)
            .withUnit('kWh')
            .withDescription('Index tarif 3 (HP ou HC — semaine ou week-end, à identifier)'),
        exposes.numeric('energy_tier_4', ea.STATE)
            .withUnit('kWh')
            .withDescription('Index tarif 4 (HP ou HC — semaine ou week-end, à identifier)'),
    ],

    configure: async (device, coordinatorEndpoint, logger) => {
        const endpoint = device.getEndpoint(1);
        await endpoint.bind('haElectricalMeasurement', coordinatorEndpoint);
        await endpoint.bind('haMeterIdentification', coordinatorEndpoint);
        await endpoint.bind('seMetering', coordinatorEndpoint);
        logger.info(`Somfy Linky : clusters liés pour ${device.ieeeAddr}`);
    },
};

module.exports = definition;
