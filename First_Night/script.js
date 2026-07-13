document.addEventListener('DOMContentLoaded', () => {
    // Referencias Oficina
    const flashlight = document.getElementById('flashlight');
    const environment = document.getElementById('environment');
    const bgImage = document.getElementById('bg-image');
    const fadeOverlay = document.getElementById('fade-overlay');
    const clock = document.getElementById('clock');

    // Referencias Cámaras
    const monitorBar = document.getElementById('monitor-bar');
    const cameraSystem = document.getElementById('camera-system');
    const camBg = document.getElementById('cam-bg');
    const camBtns = document.querySelectorAll('.cam-btn');
    const camStaticFlash = document.getElementById('cam-static-flash');

    const winScreen = document.getElementById('win-screen');
    const winText = document.getElementById('win-text');
    const loseScreen = document.getElementById('lose-screen');
    const menuBtn = document.getElementById('menu-btn');
    const screamer = document.getElementById('screamer');
    const screamerFrame = document.getElementById('screamer-frame');

    // Referencias de defensas
    const handArmario = document.getElementById('hand-armario');

    // Referencias del joystick de PS5
    const joystickBar = document.getElementById('joystick-bar');
    const joyBarFill = document.getElementById('joystick-bar-fill');
    const jsBackdrop = document.getElementById('js-backdrop');
    const jsUnit = document.getElementById('js-unit');
    const jsPsButton = document.getElementById('js-ps-button');
    const jsChargeFill = document.getElementById('js-charge-fill');

    menuBtn.addEventListener('click', () => {
        window.location.href = '../MenuGame/index.html';
    });

    // Intro sequence
    setTimeout(() => {
        fadeOverlay.classList.remove('active');
        setTimeout(() => {
            fadeOverlay.innerHTML = '';
        }, 300);
    }, 2000);

    // Sonido ambiente de la noche
    const atmosphereSound = new Audio('SOUND/atmosfera.mp3');
    atmosphereSound.loop = true;
    atmosphereSound.volume = 0.5;

    function startAtmosphere() {
        atmosphereSound.play().catch(() => {});
    }
    startAtmosphere();
    // Si el navegador bloqueó el autoplay, arranca en la primera interacción del jugador
    document.addEventListener('pointerdown', startAtmosphere, { once: true });
    document.addEventListener('mousemove', startAtmosphere, { once: true });

    let targetX = window.innerWidth / 2;
    let targetY = window.innerHeight / 2;
    let currentX = targetX;
    let currentY = targetY;

    // Directorio y archivos de Cámaras (por sala, no todas tienen foto)
    const CAM_FILES = {
        comedor: { alone: 'Camera/comedor_alone.jpg', monge: 'Camera/comedor_monge.jpg' },
        living: { alone: 'Camera/living_alone.jpg', monge: 'Camera/living_monge.png' },
        cocina: { alone: 'Camera/cocina_alone.jpg', monge: 'Camera/cocina_monge.png' },
        exterior: { alone: 'Camera/exterior_alone.jpg', monge: 'Camera/exterior_monge.jpg' },
    };

    let currentScene = 'CENTER';
    let isTransitioning = false;
    let isMonitorUp = false; // ESTADO DEL MONITOR
    let canClick = false;
    let nextSceneTarget = null;
    let currentCamKey = 'living';

    // --- IA DEL MONGE ---
    // Grafo de patrulla: cada sala es un nodo real por el que el monge deambula.
    // Salas totalmente interconectadas para que el recorrido varíe y no sea un embudo.
    // comedor y living son "hubs" seguros; las salas peligrosas cuelgan de ellos.
    // Los pesos van por repetición de entradas: desde el living tiende a la cocina (puerta).
    const PATROL_GRAPH = {
        comedor:  ['living', 'living', 'cocina', 'banio', 'banio', 'exterior'],
        living:   ['cocina', 'cocina', 'banio', 'banio', 'exterior', 'comedor'],
        cocina:   ['comedor', 'living'],
        banio:    ['comedor', 'living'],
        exterior: ['comedor', 'living'],
    };

    // Salas peligrosas: al estar en ellas el monge PUEDE lanzar su ataque (no es automático).
    // La puerta puede atacarse desde la cocina Y desde el living (no solo cocina).
    const ROOM_ATTACK = {
        living:   'ATTACK_PUERTA',
        cocina:   'ATTACK_PUERTA',
        banio:    'ATTACK_ARMARIO',
        exterior: 'ATTACK_VENTANA',
    };

    // Probabilidad de atacar según la sala (no todas igual):
    // - exterior: casi seguro ataca la ventana antes de volver
    // - cocina: es su lugar preferido para lanzar el ataque de puerta
    // - living: también puede atacar la puerta, pero mucho menos que desde la cocina
    // - baño: amenaza más ocasional
    const ROOM_ATTACK_CHANCE = {
        exterior: 0.85,
        cocina:   0.55,
        banio:    0.70,
        living:   0.15,
    };

    const PATROL_MIN_MS = 10000;
    const PATROL_MAX_MS = 16000;
    const ATTACK_TIMEOUT_MS = 8000;

    let monsterNode = 'comedor';
    let prevNode = null;       // sala de la que vino: evita volver de inmediato (menos ping-pong)
    let lastAttack = null;     // último ataque ejecutado: no repetirlo dos veces seguidas
    let monsterState = 'patrol'; // patrol | ATTACK_VENTANA | ATTACK_ARMARIO | ATTACK_PUERTA
    let ventanaClosing = false;
    let patrolTimer = null;
    let attackTimer = null;
    let banioSoundPlayed = false;
    let horrorHitPlayed = false;
    const banioSound = new Audio('SOUND/baño.mp3');
    const cambiarCamaraSound = new Audio('SOUND/cambiar_camara.mp3');
    const abrirCamaraSound = new Audio('SOUND/abrir_camara.mp3');
    const cerrarVentanaSound = new Audio('SOUND/cerrar_ventana.mp3');
    const horrorHitSound = new Audio('SOUND/horror_hit.mp3');
    const screamerSound = new Audio('SOUND/screamer.mp3');
    const ps5TurnOnSound = new Audio('SOUND/ps5_turn_on.mp3');

    // --- SCREAMER ---
    const SCREAMER_FRAME_COUNT = 7;   // fotogramas Screamer/1.png .. N.png
    const SCREAMER_FRAME_MS = 83.75;  // duración de cada fotograma
    const SCREAMER_ZOOM_MS = 100;     // zoom del último fotograma para concluir

    // --- JOYSTICK DE PS5 (carga estilo caja musical de Puppet) ---
    // Se descarga siempre: lento en la oficina, rápido con la cámara arriba.
    // Se recarga manteniendo apretado sobre el joystick levantado.
    const CHARGE_TICK_MS = 100;
    const DRAIN_OFFICE_PER_SEC = 1.5; // drenaje sin cámara (lento)
    const DRAIN_CAM_PER_SEC = 5;      // drenaje con cámara arriba (rápido)
    const CHARGE_PER_SEC = 12;        // ganancia bruta al mantener apretado
    const LOW_CHARGE_THRESHOLD = 25;  // debajo de esto la barra se pone roja

    let joystickCharge = 100; // 0..100
    let joystickUp = false;   // panel en primer plano
    let charging = false;     // manteniendo apretado
    let chargeInterval = null;

    // Escena de oficina donde queda "cara a cara" con cada ataque directo
    const ATTACK_SCENE = {
        ATTACK_VENTANA: 'LEFT',
        ATTACK_ARMARIO: 'RIGHT',
        ATTACK_PUERTA: 'CENTER',
    };

    function checkFaceToFace() {
        if (isMonitorUp || horrorHitPlayed) return;
        if (ATTACK_SCENE[monsterState] === currentScene) {
            horrorHitPlayed = true;
            horrorHitSound.currentTime = 0;
            horrorHitSound.play().catch(() => {});
        }
    }

    // Cortina negra breve para cuando se espanta al monge (ventana/armario/puerta resueltos)
    function playScareCurtain(afterBlackout) {
        fadeOverlay.classList.add('active');
        setTimeout(() => {
            afterBlackout();
            setTimeout(() => {
                fadeOverlay.classList.remove('active');
            }, 700);
        }, 300);
    }

    function playBanioSound() {
        if (banioSoundPlayed) return;
        banioSoundPlayed = true;
        banioSound.currentTime = 0;
        banioSound.play().catch(() => {});
    }

    // Probabilidad de ataque de una sala, teniendo en cuenta la carga del joystick:
    // sin carga (0%), el monge se vuelve muy agresivo con la puerta.
    function effectiveAttackChance(node) {
        const base = ROOM_ATTACK_CHANCE[node] || 0;
        if (joystickCharge <= 0 && ROOM_ATTACK[node] === 'ATTACK_PUERTA') {
            return node === 'cocina' ? 0.90 : Math.max(base, 0.45);
        }
        return base;
    }

    function scheduleNextPatrolStep() {
        clearTimeout(patrolTimer);
        if (!gameActive) return;
        const delay = PATROL_MIN_MS + Math.random() * (PATROL_MAX_MS - PATROL_MIN_MS);
        patrolTimer = setTimeout(patrolStep, delay);
    }

    function patrolStep() {
        if (!gameActive || monsterState !== 'patrol') return;

        // 1) Si la sala actual es peligrosa, quizás ataque (nunca el mismo ataque dos veces seguidas).
        const roomAttack = ROOM_ATTACK[monsterNode];
        const chance = effectiveAttackChance(monsterNode);
        if (roomAttack && roomAttack !== lastAttack && Math.random() < chance) {
            startAttack(roomAttack);
            return;
        }

        // 2) Si no ataca, sigue deambulando, evitando volver directo a la sala anterior.
        let options = PATROL_GRAPH[monsterNode];
        const filtered = options.filter(n => n !== prevNode);
        if (filtered.length) options = filtered;
        const next = options[Math.floor(Math.random() * options.length)];

        prevNode = monsterNode;
        monsterNode = next;
        if (monsterNode !== 'banio') banioSoundPlayed = false;
        refreshCurrentCamera();
        scheduleNextPatrolStep();
    }

    function startAttack(type) {
        monsterState = type;
        lastAttack = type; // recordar para no repetir el mismo ataque en la próxima
        horrorHitPlayed = false;
        refreshOfficeScene();
        refreshCurrentCamera();
        updateHotspots();
        clearTimeout(attackTimer);
        attackTimer = setTimeout(() => {
            loseGame();
        }, ATTACK_TIMEOUT_MS);
    }

    function resolveAttack() {
        clearTimeout(attackTimer);
        playScareCurtain(() => {
            monsterNode = 'living';
            prevNode = null;
            monsterState = 'patrol';
            banioSoundPlayed = false;
            horrorHitPlayed = false;
            refreshOfficeScene();
            refreshCurrentCamera();
            updateHotspots();
            scheduleNextPatrolStep();
        });
    }

    function closeWindow() {
        if (monsterState !== 'ATTACK_VENTANA' || currentScene !== 'LEFT') return;
        clearTimeout(attackTimer);
        ventanaClosing = true;
        cerrarVentanaSound.currentTime = 0;
        cerrarVentanaSound.play().catch(() => {});
        bgImage.style.backgroundImage = `url('ventana_monge_closed.png')`;
        setTimeout(() => {
            ventanaClosing = false;
            resolveAttack();
        }, 1200);
    }

    handArmario.addEventListener('click', (e) => {
        e.stopPropagation();
        if (monsterState !== 'ATTACK_ARMARIO' || currentScene !== 'RIGHT') return;
        resolveAttack();
    });

    // --- JOYSTICK: levantar / bajar (primer plano estilo cámara) ---
    function setJoystickUp(up) {
        if (up && isMonitorUp) {
            // No se puede tener cámara y joystick a la vez: baja la cámara
            cameraSystem.classList.remove('active');
            isMonitorUp = false;
        }
        joystickUp = up;
        if (!up) charging = false;
        document.body.classList.toggle('joystick-up', up);
        updateJoystickBar();
    }

    function updateJoystickBar() {
        // La barra del joystick solo se ve en la oficina (no con la cámara arriba)
        joystickBar.classList.toggle('hidden', isMonitorUp || !gameActive);
    }

    function updateChargeUI() {
        const pct = Math.round(joystickCharge);
        const color = pct <= LOW_CHARGE_THRESHOLD ? '#c0392b' : '#2ecc71';
        jsChargeFill.style.width = pct + '%';
        jsChargeFill.style.background = color;
        joyBarFill.style.width = pct + '%';
        joyBarFill.style.background = color;
    }

    // Prender la PS5 para espantar al monge de la puerta (requiere carga)
    function powerOnPS5() {
        if (joystickCharge <= 0) return;
        ps5TurnOnSound.currentTime = 0;
        ps5TurnOnSound.play().catch(() => {});
        setJoystickUp(false);
        resolveAttack();
    }

    // Levantar/bajar el joystick haciendo click en su barra lateral (no como la cámara)
    joystickBar.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!gameActive || isTransitioning) return;
        setJoystickUp(!joystickUp);
        abrirCamaraSound.currentTime = 0;
        abrirCamaraSound.play().catch(() => {});
    });

    // Mantener apretado sobre el joystick levantado = cargar.
    // Durante el ataque de puerta NO se carga: hay que clickear el logo PS puntual.
    jsBackdrop.addEventListener('mousedown', () => {
        if (!gameActive || !joystickUp) return;
        if (monsterState === 'ATTACK_PUERTA') return;
        charging = true;
    });

    // Click en el botón PS: prende la PS5 si el monge está en la puerta; si no, carga.
    jsPsButton.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        if (!gameActive || !joystickUp) return;
        if (monsterState === 'ATTACK_PUERTA') {
            powerOnPS5();
        } else {
            charging = true;
        }
    });

    document.addEventListener('mouseup', () => { charging = false; });

    // Bucle de carga/descarga
    function chargeTick() {
        if (!gameActive) return;
        const dt = CHARGE_TICK_MS / 1000;
        let delta;
        if (charging && joystickUp && !isMonitorUp) {
            delta = (CHARGE_PER_SEC - DRAIN_OFFICE_PER_SEC) * dt;
        } else {
            delta = -(isMonitorUp ? DRAIN_CAM_PER_SEC : DRAIN_OFFICE_PER_SEC) * dt;
        }
        joystickCharge = Math.max(0, Math.min(100, joystickCharge + delta));
        updateChargeUI();
    }

    function updateHotspots() {
        const armarioActive = monsterState === 'ATTACK_ARMARIO' && currentScene === 'RIGHT' && !isMonitorUp;
        handArmario.classList.toggle('hidden', !armarioActive);

        // El logo PS parpadea cuando el monge está en la puerta (hay que clickearlo)
        jsPsButton.classList.toggle('js-ps-alert', monsterState === 'ATTACK_PUERTA');
    }

    // Imagen de cámara según si el monge está realmente ahí (si está atacando, ya se fue de la sala)
    function getCamImage(camKey) {
        const files = CAM_FILES[camKey];
        const monsterHere = monsterState === 'patrol' && monsterNode === camKey;
        return monsterHere ? files.monge : files.alone;
    }

    function refreshCurrentCamera() {
        if (currentCamKey === 'banio') {
            camBg.classList.add('cam-banio-placeholder');
            camBg.style.backgroundImage = 'none';
            if (monsterState === 'patrol' && monsterNode === 'banio') playBanioSound();
        } else {
            camBg.classList.remove('cam-banio-placeholder');
            camBg.style.backgroundImage = `url('${getCamImage(currentCamKey)}')`;
        }
    }

    // Imagen de la escena de oficina según el estado del monge
    function getSceneImage(scene) {
        if (scene === 'CENTER') {
            return monsterState === 'ATTACK_PUERTA' ? 'office_monge.jpg' : 'office_alone.jpg';
        }
        if (scene === 'LEFT') {
            if (ventanaClosing) return 'ventana_monge_closed.png';
            return monsterState === 'ATTACK_VENTANA' ? 'ventana_monge.png' : 'ventana_alone.png';
        }
        if (scene === 'RIGHT') {
            return monsterState === 'ATTACK_ARMARIO' ? 'armario_monge.png' : 'armario_alone.png';
        }
    }

    function refreshOfficeScene() {
        if (isMonitorUp || isTransitioning) return;
        bgImage.style.backgroundImage = `url('${getSceneImage(currentScene)}')`;
        updateHotspots();
        checkFaceToFace();
    }

    // Sistema de Tiempo
    let currentHour = 0;
    let gameActive = true;
    const millisecondsPerHour = 60000;

    const timerInterval = setInterval(() => {
        if (!gameActive) return;
        currentHour++;
        if (currentHour < 6) {
            clock.innerText = `${currentHour} AM`;
        } else {
            triggerWin();
        }
    }, millisecondsPerHour);

    function triggerWin() {
        gameActive = false;
        clearInterval(timerInterval);
        clearInterval(chargeInterval);
        clearTimeout(patrolTimer);
        clearTimeout(attackTimer);
        atmosphereSound.pause();
        if (isMonitorUp) {
            cameraSystem.classList.remove('active');
            isMonitorUp = false;
        }
        setJoystickUp(false);
        winScreen.classList.add('active');
        setTimeout(() => {
            winText.innerText = "6:00 AM";
        }, 2000);
    }

    function loseGame() {
        if (!gameActive) return;
        gameActive = false;
        clearInterval(timerInterval);
        clearInterval(chargeInterval);
        clearTimeout(patrolTimer);
        clearTimeout(attackTimer);
        atmosphereSound.pause();
        setJoystickUp(false);

        // Dirigir la vista hacia la zona de donde proviene el screamer
        const scene = ATTACK_SCENE[monsterState] || 'CENTER';
        if (isMonitorUp) {
            cameraSystem.classList.remove('active');
            isMonitorUp = false;
        }
        // La habitación vuelve a su estado alone (el monge ya no está en la escena de fondo)
        monsterState = 'patrol';
        ventanaClosing = false;
        isTransitioning = false;
        currentScene = scene;
        bgImage.style.backgroundImage = `url('${getSceneImage(scene)}')`;
        handArmario.classList.add('hidden');

        playScreamer();
    }

    function playScreamer() {
        screamerSound.currentTime = 0;
        screamerSound.play().catch(() => {});
        screamer.classList.add('active');

        let frame = 1;
        function step() {
            screamerFrame.src = `Screamer/${frame}.png`;

            if (frame >= SCREAMER_FRAME_COUNT) {
                // Último fotograma: zoom para concluir y luego pantalla de derrota
                requestAnimationFrame(() => screamerFrame.classList.add('zoom'));
                setTimeout(showLoseScreen, SCREAMER_ZOOM_MS);
                return;
            }
            frame++;
            setTimeout(step, SCREAMER_FRAME_MS);
        }
        step();
    }

    function showLoseScreen() {
        screamer.classList.remove('active');
        screamerFrame.classList.remove('zoom');
        loseScreen.classList.add('active');
    }

    // --- LÓGICA DEL MONITOR DE CÁMARAS ---
    monitorBar.addEventListener('mouseenter', () => {
        if (!gameActive || isTransitioning) return;

        // No se puede tener joystick y cámara a la vez
        if (joystickUp) setJoystickUp(false);

        isMonitorUp = !isMonitorUp;

        if (isMonitorUp) {
            cameraSystem.classList.add('active');
            document.body.classList.remove('can-click');
            abrirCamaraSound.currentTime = 0;
            abrirCamaraSound.play().catch(() => {});
        } else {
            cameraSystem.classList.remove('active');
            // Re-evaluar zonas al bajar la cámara
            checkInteractionZones(targetX);
            refreshOfficeScene();
        }
        updateJoystickBar();
        updateHotspots();
    });

    camBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            if (e.target.classList.contains('active')) return;

            // Actualizar botón activo
            camBtns.forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');

            // Flash de estática
            camStaticFlash.classList.add('flash');
            cambiarCamaraSound.currentTime = 0;
            cambiarCamaraSound.play().catch(() => {});

            const camKey = e.target.getAttribute('data-cam');
            currentCamKey = camKey;
            if (camKey !== 'banio') banioSoundPlayed = false;

            setTimeout(() => {
                refreshCurrentCamera();
                currentX = window.innerWidth / 2;
                camBg.style.transform = `translateX(0px)`;
                camStaticFlash.classList.remove('flash');
                if (camKey === 'banio' && monsterState === 'patrol' && monsterNode === 'banio') playBanioSound();
                updateHotspots();
            }, 150); // Tiempo que dura el pantallazo blanco de estática
        });
    });


    // --- TRACKING DEL MOUSE (Actualizado) ---
    document.addEventListener('mousemove', (e) => {
        if (!gameActive || isTransitioning) return;
        targetX = e.clientX;
        targetY = e.clientY;

        if (joystickUp) {
            // Desplazar el joystick de arriba hacia abajo según el mouse
            const pan = (e.clientY / window.innerHeight - 0.5) * 60;
            jsUnit.style.setProperty('--js-pan', pan.toFixed(1) + 'px');
        } else if (!isMonitorUp) {
            checkInteractionZones(targetX);
        }
    });

    document.addEventListener('click', () => {
        if (!gameActive || isTransitioning || isMonitorUp || joystickUp) return;

        if (monsterState === 'ATTACK_VENTANA' && currentScene === 'LEFT' && !canClick) {
            closeWindow();
            return;
        }

        if (canClick && nextSceneTarget) {
            switchScene(nextSceneTarget);
        }
    });

    function checkInteractionZones(mouseX) {
        if (isMonitorUp) return; // No calcular si vemos las cámaras

        const screenWidth = window.innerWidth;
        const leftThreshold = screenWidth * 0.20;
        const rightThreshold = screenWidth * 0.80;

        canClick = false;
        nextSceneTarget = null;
        document.body.classList.remove('can-click');

        if (currentScene === 'CENTER') {
            if (mouseX <= leftThreshold) {
                canClick = true; nextSceneTarget = 'LEFT';
            } else if (mouseX >= rightThreshold) {
                canClick = true; nextSceneTarget = 'RIGHT';
            }
        } else if (currentScene === 'LEFT') {
            if (mouseX >= rightThreshold) {
                canClick = true; nextSceneTarget = 'CENTER';
            }
        } else if (currentScene === 'RIGHT') {
            if (mouseX <= leftThreshold) {
                canClick = true; nextSceneTarget = 'CENTER';
            }
        }

        if (canClick) { document.body.classList.add('can-click'); }
    }

    function switchScene(targetScene) {
        isTransitioning = true;
        document.body.classList.remove('can-click');

        fadeOverlay.classList.add('active');

        setTimeout(() => {
            currentScene = targetScene;
            bgImage.style.backgroundImage = `url('${getSceneImage(targetScene)}')`;
            checkFaceToFace();

            targetX = window.innerWidth / 2;
            targetY = window.innerHeight / 2;
            currentX = targetX;
            currentY = targetY;

            fadeOverlay.classList.remove('active');

            setTimeout(() => {
                isTransitioning = false;
                checkInteractionZones(targetX);
                updateHotspots();
            }, 300);

        }, 300);
    }

    // Bucle principal
    function animate() {
        if (!gameActive) return;

        if (!isMonitorUp) {
            currentX += (targetX - currentX) * 0.15;
            currentY += (targetY - currentY) * 0.15;

            flashlight.style.setProperty('--x', `${currentX}px`);
            flashlight.style.setProperty('--y', `${currentY}px`);

            const moveX = (currentX / window.innerWidth - 0.5) * 2;
            const moveY = (currentY / window.innerHeight - 0.5) * 2;
            const parallaxStrength = 20;
            environment.style.transform = `translate(${moveX * -parallaxStrength}px, ${moveY * -parallaxStrength}px)`;

            if (Math.random() > 0.95) {
                const randomOpacity = 0.85 + Math.random() * 0.15;
                flashlight.style.setProperty('--flicker', randomOpacity);
                const randomSize = 490 + Math.random() * 20;
                flashlight.style.setProperty('--size', `${randomSize}px`);
            } else {
                flashlight.style.setProperty('--size', `500px`);
                flashlight.style.setProperty('--flicker', `0.95`);
            }
       }
        // Lógica de Panning de Cámaras (cuando el monitor está ARRIBA)
        else {
            // 1. Lerp lento en AMBOS ejes para la sensación de peso mecánico
            currentX += (targetX - currentX) * 0.05;
            currentY += (targetY - currentY) * 0.05;

            // 2. Convertimos la posición actual a un porcentaje (de 0% a 100%)
            const percentX = (currentX / window.innerWidth) * 100;
            const percentY = (currentY / window.innerHeight) * 100;

            // 3. Movemos el INTERIOR de la imagen (background-position)
            // Si el mouse está arriba del todo (0%), muestra el tope absoluto de la foto.
            camBg.style.backgroundPosition = `${percentX}% ${percentY}%`;
        }

        requestAnimationFrame(animate);
    }

    refreshCurrentCamera();
    updateHotspots();
    updateChargeUI();
    updateJoystickBar();
    chargeInterval = setInterval(chargeTick, CHARGE_TICK_MS);
    scheduleNextPatrolStep();
    animate();
});
