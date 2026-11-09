import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { once } from 'node:events';
import pg from 'pg';
import express from 'express';
import mqtt from 'mqtt';
import { crearFixturesRelease2 } from '../../src/stubs/release2/fixtures.js';

// Activación explícita: crea/elimina sus BD, nunca migra la BD de la aplicación.
test('A: PostgreSQL aislado, migración, HTTP y MQTT', {
    skip: process.env.R2A_INTEGRATION !== '1' ? 'Requiere R2A_INTEGRATION=1 y PostgreSQL de pruebas' : false,
    timeout: 60000,
}, async (t) => {
    const database = `r2a_${process.pid}_${randomBytes(4).toString('hex')}`;
    const config = { host: process.env.DB_HOST || '127.0.0.1', port: Number(process.env.DB_PORT || 5432), user: process.env.DB_USER, password: process.env.DB_PASSWORD };
    const admin = new pg.Client({ ...config, database: 'postgres' });
    await admin.connect();
    const nombres = [];
    const conexiones = [];
    let sequelize;
    let servidor;
    let receptor;
    let publicador;
    t.after(async () => {
        if (publicador) await publicador.endAsync();
        if (receptor) await receptor.endAsync();
        if (servidor) await new Promise((resolve, reject) => servidor.close((err) => err ? reject(err) : resolve()));
        if (sequelize) await sequelize.close();
        for (const client of conexiones) await client.end();
        for (const nombre of nombres) {
            await admin.query('SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1 AND pid <> pg_backend_pid()', [nombre]);
            await admin.query(`DROP DATABASE IF EXISTS "${nombre}"`);
        }
        await admin.end();
    });
    async function crearDb(nombre) {
        await admin.query(`CREATE DATABASE "${nombre}"`);
        nombres.push(nombre);
        const client = new pg.Client({ ...config, database: nombre });
        await client.connect(); conexiones.push(client); return client;
    }
    const db = await crearDb(database);
    const r1 = await readFile(new URL('../fixtures/r1-schema.sql', import.meta.url), 'utf8');
    const migracion = await readFile(new URL('../../database/migrations/20261105_release2_actividad.sql', import.meta.url), 'utf8');
    const eventosSql = await readFile(new URL('../../database/migrations/20261105_release2_eventos_pendientes.sql', import.meta.url), 'utf8');
    const productoSql = await readFile(new URL('../../database/migrations/20261109_create_producto.sql', import.meta.url), 'utf8');
    const productoNombreSql = await readFile(new URL('../../database/migrations/20261109_add_producto_nombre.sql', import.meta.url), 'utf8');
    const productoTipoVidrioSql = await readFile(new URL('../../database/migrations/20261109_update_producto_tipo_vidrio.sql', import.meta.url), 'utf8');
    const productoPesoSql = await readFile(new URL('../../database/migrations/20261109_add_producto_peso_gramos.sql', import.meta.url), 'utf8');
    const fixture = crearFixturesRelease2();
    async function cargarR1(client) {
        await client.query(r1);
        for (const u of fixture.usuarios) await client.query('INSERT INTO usuario(cod_user,id_user,nombre,puntos,tipo,contrasena,estado) VALUES($1,$2,$3,$4,$5,$6,$7)', [u.cod_user,u.id_user,u.nombre,u.puntos,u.tipo,'solo-fixture-no-login',u.estado]);
        for (const c of fixture.tachos) await client.query('INSERT INTO tachointeligente(id_tacho,tipo,latitud,longitud,capacidad,porcentaje,estado) VALUES($1,$2,$3,$4,$5,$6,$7)', [c.id_tacho,c.tipo,c.latitud,c.longitud,c.capacidad,c.porcentaje,c.estado]);
        for (const r of fixture.residuos) await client.query('INSERT INTO residuo(id_residuo,id_user,id_tacho,tipo,peso) VALUES($1,$2,$3,$4,$5)', [r.id_residuo,r.id_user,r.id_tacho,r.tipo,r.peso]);
        for (const h of fixture.historialConDuplicado) await client.query('INSERT INTO historialreciclaje(id_historial,id_residuo,id_user,id_tacho,fecha) VALUES($1,$2,$3,$4,$5)', [h.id_historial,h.id_residuo,h.id_user,h.id_tacho,h.fecha]);
    }
    await cargarR1(db);
    const saldos = (await db.query('SELECT id_user,puntos FROM usuario ORDER BY id_user')).rows;
    await t.test('A6: migración R1 y repetición conservan saldos/DATE y deduplican actividad', async () => {
        await db.query(migracion); await db.query(eventosSql);
        await db.query(migracion); await db.query(eventosSql);
        await db.query(productoSql); await db.query(productoSql);
        await db.query("INSERT INTO producto(id_producto,cod_producto,tipo) VALUES(1,'12345678','plastico')");
        await db.query(productoNombreSql); await db.query(productoNombreSql);
        await db.query("INSERT INTO producto(id_producto,cod_producto,nombre,tipo) VALUES(2,'23456789','Restos de comida','organicos')");
        await db.query(productoTipoVidrioSql); await db.query(productoTipoVidrioSql);
        await db.query(productoPesoSql); await db.query(productoPesoSql);
        assert.equal((await db.query("SELECT nombre FROM producto WHERE cod_producto='12345678'")).rows[0].nombre, 'Producto 12345678');
        assert.deepEqual(
            (await db.query("SELECT nombre,tipo,peso_gramos FROM producto WHERE cod_producto='23456789'")).rows[0],
            { nombre: 'Producto de vidrio', tipo: 'vidrio', peso_gramos: 400 }
        );
        assert.equal(
            (await db.query("SELECT peso_gramos FROM producto WHERE cod_producto='12345678'")).rows[0].peso_gramos,
            25
        );
        await assert.rejects(
            db.query("INSERT INTO producto(id_producto,cod_producto,nombre,peso_gramos,tipo) VALUES(99,'87654321','Producto inválido',10,'organico')"),
            /producto_tipo_valido/
        );
        await assert.rejects(
            db.query("INSERT INTO producto(id_producto,cod_producto,nombre,peso_gramos,tipo) VALUES(99,'1234567','Producto inválido',10,'plastico')"),
            /producto_cod_producto_formato/
        );
        await assert.rejects(
            db.query("INSERT INTO producto(id_producto,cod_producto,nombre,peso_gramos,tipo) VALUES(99,'87654321','Producto inválido',0,'plastico')"),
            /producto_peso_gramos_positivo/
        );
        assert.deepEqual((await db.query('SELECT id_user,puntos FROM usuario ORDER BY id_user')).rows, saldos);
        assert.equal((await db.query('SELECT COUNT(*)::int AS n FROM actividad_reciclaje')).rows[0].n, fixture.residuos.length);
        assert.equal((await db.query('SELECT COUNT(*)::int AS n FROM historialreciclaje')).rows[0].n, fixture.historialConDuplicado.length);
        assert.equal((await db.query('SELECT COUNT(*)::int AS n FROM historialreciclaje WHERE fecha_instante IS NOT NULL')).rows[0].n, 0);
        assert.equal((await db.query('SELECT SUM(puntos_ganados) AS n FROM residuo')).rows[0].n, 27.5);
    });
    await t.test('A6: creación nueva y migraciones posteriores producen la misma estructura utilizable', async () => {
        const nuevo = await crearDb(`${database}_new`);
        await nuevo.query(await readFile(new URL('../../database/schema.sql', import.meta.url), 'utf8'));
        await nuevo.query(migracion); await nuevo.query(eventosSql);
        await nuevo.query(productoSql);
        await nuevo.query(productoNombreSql);
        await nuevo.query(productoTipoVidrioSql);
        await nuevo.query(productoPesoSql);
        assert.equal((await nuevo.query('SELECT COUNT(*)::int AS n FROM actividad_reciclaje')).rows[0].n, 0);
        const columnas = async (client) => (await client.query("SELECT table_name,column_name,data_type,is_nullable FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name,column_name")).rows;
        assert.deepEqual(await columnas(nuevo), await columnas(db));
    });
    await t.test('A6: historial contradictorio aborta migración sin dejar columnas parciales', async () => {
        const malo = await crearDb(`${database}_bad`); await cargarR1(malo);
        await malo.query("INSERT INTO historialreciclaje VALUES(300,'2026-01-16',1,3,42)");
        await assert.rejects(malo.query(migracion), /historial contradictorio/);
        await malo.query('ROLLBACK');
        assert.equal((await malo.query("SELECT COUNT(*)::int AS n FROM information_schema.columns WHERE table_name='residuo' AND column_name='puntos_ganados'")).rows[0].n, 0);
        await malo.query('DELETE FROM historialreciclaje WHERE id_historial=300');
        await malo.query("UPDATE residuo SET tipo='vidrio' WHERE id_residuo=42");
        await assert.rejects(malo.query(migracion), /material o peso inválido/);
        await malo.query('ROLLBACK');
    });
    process.env.DATABASE_URL = ''; process.env.DB_NAME = database;
    process.env.JWT_SECRET = randomBytes(48).toString('hex');
    sequelize = (await import('../../src/config/db.js')).default;
    const estadisticas = await import('../../src/services/estadistica.service.js');
    const dashboard = await import('../../src/services/dashboard.service.js');
    const { obtenerMetricas } = await import('../../src/services/metrica.service.js');
    const { verificarContratoEstadisticas } = await import('../../src/stubs/release2/verificar-estadisticas.js');
    const { obtenerTachos, obtenerTacho, obtenerTachosCercanos } = await import('../../src/services/tacho.service.js');
    const { registrarResiduo, procesarJSONTacho } = await import('../../src/services/residuo.service.js');
    await t.test('A6: proveedor real pasa los mismos escenarios de Fase 0 que el doble', async () => {
        await verificarContratoEstadisticas(estadisticas);
        await assert.rejects(estadisticas.obtenerEstadisticasUsuario(999), { statusCode: 404 });
    });
    await t.test('A1/A2/A3: kg sin doble conteo, materiales, participantes y vacíos', async () => {
        const materiales = await dashboard.obtenerMateriales(fixture.filtros.enero);
        assert.equal(materiales.totalResiduos, 5); assert.equal(materiales.pesoTotalKg, 2.5);
        const participacion = await dashboard.obtenerParticipacion(fixture.filtros.enero);
        assert.deepEqual({ ...participacion, porPeriodo: undefined }, { ...fixture.resultados.participacionEnero, porPeriodo: undefined });
        const personal = await obtenerMetricas(1, { ...fixture.filtros.enero, material: 'plastico' });
        assert.equal(personal.totalResiduos, 1); assert.equal(personal.pesoTotalKg, 0.25);
        assert.deepEqual(Object.keys(personal).sort(), ['totalResiduos','pesoTotalKg','porTipo','porPeriodo','porTipoYPeriodo'].sort());
        assert.deepEqual((await dashboard.obtenerMateriales(fixture.filtros.vacio)).porPeriodo, []);
        assert.equal((await dashboard.obtenerMateriales({ material: 'organicos' })).pesoTotalKg, 1.25);
        await db.query("UPDATE usuario SET estado=false WHERE tipo='usuario'");
        assert.deepEqual(await dashboard.obtenerParticipacion(), { participantes: 0, denominador: 0, tasaPorcentaje: null, porPeriodo: [] });
        for (const u of fixture.usuarios) await db.query('UPDATE usuario SET estado=$1 WHERE id_user=$2', [u.estado,u.id_user]);
    });
    await t.test('A6: contradicción posterior también se rechaza, no produce totales arbitrarios', async () => {
        await db.query("INSERT INTO historialreciclaje VALUES(300,'2026-01-16',1,3,42,NULL)");
        await assert.rejects(estadisticas.obtenerEstadisticasUsuario(1), { statusCode: 409 });
        await assert.rejects(dashboard.obtenerMateriales(), { statusCode: 409 });
        await db.query('DELETE FROM historialreciclaje WHERE id_historial=300');
    });
    await t.test('A3: instantes nuevos respetan frontera de mes de Lima y conservan DATE histórico', async () => {
        for (let i=0;i<fixture.limitesMes.length;i++) {
            const b=fixture.limitesMes[i], id=500+i;
            await db.query("INSERT INTO residuo VALUES($1,0.1,'plastico',NULL,1,3,1)",[id]);
            await db.query('INSERT INTO historialreciclaje(id_historial,id_residuo,id_user,id_tacho,fecha,fecha_instante) VALUES($1,$1,1,3,$2,$3)',[id,b.diaLima,b.instanteUTC]);
        }
        assert.equal((await obtenerMetricas(1,fixture.filtros.enero)).totalResiduos,3);
        assert.equal((await obtenerMetricas(1,fixture.filtros.febrero)).totalResiduos,2);
        await db.query('DELETE FROM historialreciclaje WHERE id_residuo>=500'); await db.query('DELETE FROM residuo WHERE id_residuo>=500');
    });
    await t.test('A5: listado/detalle/cercanía real ocultan inactivos y ordenan distancia', async () => {
        await db.query("INSERT INTO tachointeligente VALUES(9,'plastico',-12.0464,-77.05,false,10,true)");
        assert.deepEqual((await obtenerTachos()).map(({ idTacho }) => idTacho), [3,9]);
        await assert.rejects(obtenerTacho(4), { statusCode:404 });
        assert.deepEqual((await obtenerTachosCercanos({lat:-12.0464,lng:-77.0428,radio:1000})).map(({idTacho})=>idTacho),[3,9]);
        assert.deepEqual(await obtenerTachosCercanos({lat:0,lng:0}),[]);
    });
    const { default: router } = await import('../../src/routes/index.routes.js');
    const { default: errorMiddleware } = await import('../../src/middlewares/error.middleware.js');
    const { createAccessToken } = await import('../../src/utils/jwt.js');
    const app=express(); app.use(express.json()); app.use('/api',router); app.use(errorMiddleware);
    servidor=app.listen(0,'127.0.0.1'); await once(servidor,'listening');
    const base=`http://127.0.0.1:${servidor.address().port}`;
    const tokens=Object.fromEntries([1,2,3,4].map(id=>[id,createAccessToken({id_user:id})]));
    async function get(path,id) { const response=await fetch(base+path,{headers:id?{authorization:`Bearer ${tokens[id]}`}:{}});return {status:response.status,body:await response.json()}; }
    await t.test('A1/A2/A3 HTTP: 401/403, admin, privacidad personal y validación de filtros', async () => {
        assert.equal((await get('/api/dashboard/materiales')).status,401);
        assert.equal((await get('/api/dashboard/materiales',1)).status,403);
        assert.equal((await get('/api/dashboard/participacion',3)).status,401);
        assert.equal((await get('/api/dashboard/materiales',4)).status,200);
        assert.equal((await get('/api/dashboard/participacion',4)).body.data.denominador,3);
        const propio=await get('/api/usuarios/me/metricas',1);
        assert.equal(propio.body.data.totalResiduos,3);
        assert.equal((await get('/api/usuarios/me/metricas',2)).body.data.totalResiduos,1);
        assert.equal((await get('/api/usuarios/me/metricas?idUser=2',1)).status,400);
        for (const query of ['desde=2026-02-30','desde=2026-02-02&hasta=2026-02-01','material=vidrio','hasta[]=2026-02-01']) {
            assert.equal((await get('/api/dashboard/materiales?'+query,4)).status,400);
        }
        assert.equal((await get('/api/dashboard/participacion?material=plastico',4)).status,400);
    });
    // Los imports del router cargan listeners de B; esta prueba solo registra
    // reciclaje en bus real antes de conectar recuperables (Fase 2).
    await t.test('A4/A6: producción atómica de actividad/ganado/pendiente, idempotencia y rollback', async () => {
        const entrada={idUser:1,idTacho:3,tipo:'plastico',peso:0.25,idempotencyKey:'atomico-1'};
        const resultado=await registrarResiduo(entrada);
        assert.equal(resultado.puntosGanados,2.5);
        const filas=await db.query('SELECT r.puntos_ganados,h.fecha_instante,(h.fecha_instante AT TIME ZONE \'America/Lima\')::date=h.fecha AS correcto FROM residuo r JOIN historialreciclaje h USING(id_residuo) WHERE r.id_residuo=$1',[resultado.idResiduo]);
        assert.equal(filas.rows[0].puntos_ganados,2.5); assert.equal(filas.rows[0].correcto,true); assert.ok(filas.rows[0].fecha_instante);
        const pendiente=(await db.query('SELECT * FROM evento_pendiente WHERE referencia=$1',[String(resultado.idResiduo)])).rows[0];
        assert.equal(pendiente.payload.idResiduo,resultado.idResiduo);
        await assert.rejects(registrarResiduo(entrada),{statusCode:409});
        assert.equal((await db.query('SELECT COUNT(*)::int AS n FROM evento_pendiente')).rows[0].n,1);
        assert.equal((await db.query('SELECT puntos FROM usuario WHERE id_user=1')).rows[0].puntos,7.5);
        const {default: pendientes}=await import('../../src/repositories/eventoPendiente.repository.js');
        const original=pendientes.registrarReciclaje;
        pendientes.registrarReciclaje=async()=>{throw new Error('fallo al persistir evento de prueba');};
        try { await assert.rejects(registrarResiduo({...entrada,idempotencyKey:'rollback-1'}),/fallo al persistir/); }
        finally { pendientes.registrarReciclaje=original; }
        assert.equal((await db.query("SELECT COUNT(*)::int AS n FROM residuo WHERE idempotency_key='rollback-1'")).rows[0].n,0);
        assert.equal((await db.query('SELECT puntos FROM usuario WHERE id_user=1')).rows[0].puntos,7.5);
        assert.equal((await estadisticas.obtenerEstadisticasUsuario(1)).puntos_acumulados,12.5);
        await db.query('UPDATE usuario SET puntos=puntos-5 WHERE id_user=1');
        assert.equal((await estadisticas.obtenerEstadisticasUsuario(1)).puntos_acumulados,12.5);
    });
    await t.test('A4: entradas rechazadas no escriben en BD ni en eventos pendientes', async () => {
        const antes=(await db.query('SELECT COUNT(*)::int AS n FROM residuo')).rows[0].n;
        const entrada={idEvento:'rechazo-1',codUser:'00000001',idTacho:3,tipo:'plastico',peso:0.25};
        for(const [campos,code] of [[{codUser:'00000003'},404],[{codUser:'99999999'},404],[{idTacho:4},404],[{tipo:'vidrio'},400]]) {
            await assert.rejects(procesarJSONTacho({...entrada,...campos}),{statusCode:code});
        }
        assert.equal((await db.query('SELECT COUNT(*)::int AS n FROM residuo')).rows[0].n,antes);
        assert.equal((await db.query('SELECT COUNT(*)::int AS n FROM evento_pendiente')).rows[0].n,1);
    });
    await t.test('A4 MQTT real: reciclaje/duplicado y estado en temas aislados', async () => {
        process.env.MQTT_BROKER_URL=process.env.R2A_MQTT_URL || 'mqtt://127.0.0.1:1883';
        process.env.MQTT_TOPIC_TACHO_ESTADO=`${database}/estado`; process.env.MQTT_TOPIC_EVENTO_RECICLAJE=`${database}/reciclaje`;
        process.env.MQTT_TOPIC_VALIDAR_ESTUDIANTE=`${database}/estudiante/validar`;
        process.env.MQTT_TOPIC_RESPUESTA_ESTUDIANTE=`${database}/estudiante/respuesta`;
        process.env.MQTT_TOPIC_VALIDAR_PRODUCTO=`${database}/producto/validar`;
        process.env.MQTT_TOPIC_RESPUESTA_PRODUCTO=`${database}/producto/respuesta`;
        const { iniciarRecepcionMqtt }=await import('../../src/services/mqtt.service.js');
        receptor=iniciarRecepcionMqtt();
        if(!receptor.connected) await once(receptor,'connect');
        await new Promise((resolve,reject)=>receptor.subscribe([process.env.MQTT_TOPIC_TACHO_ESTADO,process.env.MQTT_TOPIC_EVENTO_RECICLAJE,process.env.MQTT_TOPIC_VALIDAR_ESTUDIANTE,process.env.MQTT_TOPIC_VALIDAR_PRODUCTO],{qos:1},err=>err?reject(err):resolve()));
        publicador=await mqtt.connectAsync(process.env.MQTT_BROKER_URL);
        await publicador.subscribeAsync(process.env.MQTT_TOPIC_RESPUESTA_ESTUDIANTE,{qos:1});
        await publicador.subscribeAsync(process.env.MQTT_TOPIC_RESPUESTA_PRODUCTO,{qos:1});
        async function validarEstudiante(codUser) {
            const respuesta=once(publicador,'message').then(([,payload])=>JSON.parse(payload.toString('utf8')));
            await publicador.publishAsync(process.env.MQTT_TOPIC_VALIDAR_ESTUDIANTE,JSON.stringify({codUser}),{qos:1});
            return respuesta;
        }
        assert.deepEqual(await validarEstudiante('00000002'),{codUser:'00000002',exists:true});
        assert.deepEqual(await validarEstudiante('99999999'),{codUser:'99999999',exists:false});
        async function validarProducto(codProducto) {
            const respuesta=once(publicador,'message').then(([,payload])=>JSON.parse(payload.toString('utf8')));
            await publicador.publishAsync(process.env.MQTT_TOPIC_VALIDAR_PRODUCTO,JSON.stringify({codProducto}),{qos:1});
            return respuesta;
        }
        await db.query("INSERT INTO producto(id_producto,cod_producto,nombre,peso_gramos,tipo) VALUES(1,'12345678','Botella de plástico',25,'plastico')");
        assert.deepEqual(await validarProducto('12345678'),{codProducto:'12345678',tipo:'plastico',peso:25});
        assert.deepEqual(await validarProducto('99999999'),{codProducto:'99999999',tipo:'desconocido',peso:0});
        const evento={idEvento:'mqtt-unico-1',codUser:'00000002',idTacho:3,tipo:'papel/carton',peso:0.5};
        await publicador.publishAsync(process.env.MQTT_TOPIC_EVENTO_RECICLAJE,JSON.stringify(evento),{qos:1});
        async function esperar(consulta) { for(let i=0;i<100;i++){if(await consulta())return;await new Promise(r=>setTimeout(r,25));}assert.fail('No se observó el efecto MQTT esperado'); }
        await esperar(async()=>(await db.query("SELECT COUNT(*)::int AS n FROM residuo WHERE idempotency_key='mqtt-unico-1'")).rows[0].n===1);
        await publicador.publishAsync(process.env.MQTT_TOPIC_EVENTO_RECICLAJE,JSON.stringify(evento),{qos:1});
        await publicador.publishAsync(process.env.MQTT_TOPIC_TACHO_ESTADO,JSON.stringify({idTacho:3,latitud:-12.04,longitud:-77.04,capacidad:true}),{qos:1});
        await esperar(async()=>(await db.query('SELECT capacidad FROM tachointeligente WHERE id_tacho=3')).rows[0].capacidad);
        assert.equal((await db.query("SELECT COUNT(*)::int AS n FROM residuo WHERE idempotency_key='mqtt-unico-1'")).rows[0].n,1);
        assert.equal((await db.query('SELECT puntos FROM usuario WHERE id_user=2')).rows[0].puntos,15);
        assert.equal((await db.query('SELECT COUNT(*)::int AS n FROM evento_pendiente')).rows[0].n,2);
    });
    await t.test('A4/A6: dos registros concurrentes con la misma clave confirman un solo efecto', async () => {
        const antes=(await db.query('SELECT puntos FROM usuario WHERE id_user=1')).rows[0].puntos;
        const entrada={idUser:1,idTacho:3,tipo:'plastico',peso:0.25,idempotencyKey:'concurrente-1'};
        const resultados=await Promise.allSettled([registrarResiduo(entrada),registrarResiduo(entrada)]);
        assert.equal(resultados.filter(r=>r.status==='fulfilled').length,1);
        assert.equal(resultados.find(r=>r.status==='rejected').reason.statusCode,409);
        assert.equal((await db.query('SELECT puntos FROM usuario WHERE id_user=1')).rows[0].puntos,antes+2.5);
        assert.equal((await db.query("SELECT COUNT(*)::int AS n FROM residuo WHERE idempotency_key='concurrente-1'")).rows[0].n,1);
        assert.equal((await db.query('SELECT COUNT(*)::int AS n FROM evento_pendiente')).rows[0].n,3);
    });
});
