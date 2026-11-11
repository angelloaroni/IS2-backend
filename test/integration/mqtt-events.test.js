import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import 'dotenv/config';
import pg from 'pg';

const execFileAsync = promisify(execFile);

test('MQTT: sincronización, deduplicación y concurrencia persisten en PostgreSQL', {
    skip: process.env.MQTT_EVENTS_INTEGRATION !== '1'
        ? 'Requiere MQTT_EVENTS_INTEGRATION=1 y PostgreSQL de pruebas'
        : false,
    timeout: 60000,
}, async (t) => {
    const database = `mqtt_events_${process.pid}_${randomBytes(4).toString('hex')}`;
    const config = {
        host: process.env.DB_HOST || '127.0.0.1',
        port: Number(process.env.DB_PORT || 5432),
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
    };
    const admin = new pg.Client({ ...config, database: 'postgres' });
    await admin.connect();

    let sequelize;
    t.after(async () => {
        if (sequelize) {
            await sequelize.close();
        }
        await admin.query(
            'SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1 AND pid <> pg_backend_pid()',
            [database]
        );
        await admin.query(`DROP DATABASE IF EXISTS "${database}"`);
        await admin.end();
    });

    await admin.query(`CREATE DATABASE "${database}"`);
    process.env.DATABASE_URL = '';
    process.env.DB_NAME = database;
    const { default: db } = await import('../../src/config/db.js');
    sequelize = db;

    const pgClient = new pg.Client({ ...config, database });
    await pgClient.connect();
    const schema = await readFile(
        new URL('../../database/schema.sql', import.meta.url),
        'utf8'
    );
    await pgClient.query(schema);
    await pgClient.query(
        `INSERT INTO usuario(cod_user, id_user, nombre, puntos, tipo, contrasena, estado)
         VALUES ('00001001', 1, 'Prueba MQTT', 0, 'usuario', 'solo-test', TRUE)`
    );
    await pgClient.query(
        `INSERT INTO tachointeligente(id_tacho, latitud, longitud, capacidad, estado)
         VALUES (1, 0, 0, FALSE, TRUE), (2, 0, 0, FALSE, TRUE), (3, 0, 0, FALSE, TRUE)`
    );
    await pgClient.query(
        `INSERT INTO residuo(id_residuo, peso, puntos_ganados, tipo, idempotency_key, id_user, id_tacho)
         VALUES
           (1, 0.1, 1, 'plastico', 'tacho-2-evento-7', 1, 2),
           (2, 0.1, 1, 'plastico', 'legacy-unsequenced-event', 1, 1)`
    );
    await pgClient.query('DROP TABLE mqtt_event_sequence');
    const migration = await readFile(
        new URL('../../database/migrations/20261111_add_mqtt_event_sequence.sql', import.meta.url),
        'utf8'
    );
    await pgClient.query(migration);
    await pgClient.query(migration);
    await pgClient.end();

    const { procesarMensaje } = await import('../../src/services/mqtt.service.js');
    const salidas = [];
    const cliente = {
        publish(topic, payload, options, callback) {
            salidas.push({ topic, payload: JSON.parse(payload), options });
            callback(null);
        },
    };
    const solicitud = (idTacho) => procesarMensaje(
        'smartbin/events/last/request',
        Buffer.from(JSON.stringify({ idTacho })),
        { cliente }
    );
    const reciclaje = (idEvento, cambios = {}) => procesarMensaje(
        'smartbin/recycle',
        Buffer.from(JSON.stringify({
            idEvento,
            codUser: '00001001',
            idTacho: 1,
            tipo: 'plastico',
            peso: 0.25,
            ...cambios,
        })),
        { cliente, temaReciclaje: 'smartbin/recycle' }
    );

    for (const [idTacho, lastEvent] of [[1, 0], [2, 7], [3, 0]]) {
        await solicitud(idTacho);
        assert.deepEqual(salidas.at(-1), {
            topic: 'smartbin/events/last/response',
            payload: { idTacho, lastEvent },
            options: { qos: 1 },
        });
    }
    await assert.rejects(solicitud(4), { statusCode: 400 });
    await assert.rejects(
        reciclaje('tacho-1-evento-1', { idTacho: 4 }),
        { statusCode: 400 }
    );
    await assert.rejects(
        procesarMensaje(
            'smartbin/events/last/request',
            Buffer.from('{malformed'),
            { cliente }
        ),
        /JSON inválido/
    );

    await reciclaje('tacho-1-evento-42');
    await solicitud(1);
    assert.deepEqual(salidas.at(-1).payload, { idTacho: 1, lastEvent: 42 });

    const antesDuplicado = (await pgClientCount(database, config));
    const puntosAntesDuplicado = await pgUserPoints(database, config);
    await reciclaje('tacho-1-evento-42');
    assert.equal(await pgClientCount(database, config), antesDuplicado);
    assert.equal(await pgUserPoints(database, config), puntosAntesDuplicado);
    await assert.rejects(
        reciclaje('tacho-1-evento-42', { peso: 0.5 }),
        { statusCode: 409 }
    );
    await assert.rejects(
        reciclaje('tacho-1-evento-42', { tipo: 'organicos' }),
        { statusCode: 409 }
    );
    const registroPrevio = await pgResiduo(database, config, 'tacho-1-evento-42');
    assert.equal(Number(registroPrevio.peso), 0.25);

    await Promise.all([
        reciclaje('tacho-1-evento-43'),
        reciclaje('tacho-1-evento-44'),
    ]);
    await solicitud(1);
    assert.deepEqual(salidas.at(-1).payload, { idTacho: 1, lastEvent: 44 });

    await Promise.all([
        reciclaje('tacho-1-evento-45'),
        reciclaje('tacho-1-evento-45'),
    ]);
    assert.equal(await pgClientCount(database, config), antesDuplicado + 3);

    await sequelize.close();
    sequelize = undefined;
    const procesoReiniciado = await execFileAsync(
        process.execPath,
        [
            '--input-type=module',
            '-e',
            `import { procesarMensaje } from './src/services/mqtt.service.js';
             import sequelize from './src/config/db.js';
             const respuestas = [];
             await procesarMensaje('smartbin/events/last/request', Buffer.from('{"idTacho":1}'), {
               cliente: { publish: (topic, payload, options, callback) => {
                 respuestas.push({ topic, payload: JSON.parse(payload), options });
                 callback(null);
               } }
             });
             console.log(JSON.stringify(respuestas[0]));
             await sequelize.close();`,
        ],
        {
            cwd: process.cwd(),
            env: { ...process.env, DB_NAME: database, DATABASE_URL: '' },
            timeout: 30000,
        }
    );
    assert.deepEqual(JSON.parse(procesoReiniciado.stdout.trim()), {
        topic: 'smartbin/events/last/response',
        payload: { idTacho: 1, lastEvent: 45 },
        options: { qos: 1 },
    });
});

async function pgClientCount(database, config) {
    const client = new pg.Client({ ...config, database });
    await client.connect();
    try {
        const { rows } = await client.query(
            'SELECT COUNT(*)::INTEGER AS cantidad FROM residuo'
        );
        return rows[0].cantidad;
    } finally {
        await client.end();
    }
}

async function pgResiduo(database, config, idempotencyKey) {
    const client = new pg.Client({ ...config, database });
    await client.connect();
    try {
        const { rows } = await client.query(
            'SELECT peso FROM residuo WHERE idempotency_key = $1',
            [idempotencyKey]
        );
        return rows[0];
    } finally {
        await client.end();
    }
}

async function pgUserPoints(database, config) {
    const client = new pg.Client({ ...config, database });
    await client.connect();
    try {
        const { rows } = await client.query(
            'SELECT puntos FROM usuario WHERE id_user = 1'
        );
        return Number(rows[0].puntos);
    } finally {
        await client.end();
    }
}
