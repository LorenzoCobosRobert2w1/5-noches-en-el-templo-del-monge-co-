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

    // Referencias de defensas
    const handArmario = document.getElementById('hand-armario');
    const ps5Hotspot = document.getElementById('ps5-hotspot');

    // Intro sequence
    setTimeout(() => {
        fadeOverlay.classList.remove('active');
        setTimeout(() => {
            fadeOverlay.innerHTML = '';
        }, 300);
    }, 2000);

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
    // Grafo de patrulla: cada nodo lista sus posibles próximos pasos.
    // Los nodos ATTACK_* no son cámaras, son las amenazas directas en la oficina.
    const PATROL_GRAPH = {
        comedor: ['living', 'cocina'],
        living: ['exterior', 'cocina', 'banio', 'comedor'],
        cocina: ['ATTACK_PUERTA'],
        banio: ['ATTACK_ARMARIO'],
        exterior: ['ATTACK_VENTANA'],
    };

    const PATROL_MIN_MS = 10000;
    const PATROL_MAX_MS = 16000;
    const ATTACK_TIMEOUT_MS = 8000;

    let monsterNode = 'comedor';
    let monsterState = 'patrol'; // patrol | ATTACK_VENTANA | ATTACK_ARMARIO | ATTACK_PUERTA
    let ventanaClosing = false;
    let patrolTimer = null;
    let attackTimer = null;
    let banioSoundPlayed = false;
    const banioSound = new Audio('SOUND/baño.mp3');

    function playBanioSound() {
        if (banioSoundPlayed) return;
        banioSoundPlayed = true;
        banioSound.currentTime = 0;
        banioSound.play().catch(() => {});
    }

    function scheduleNextPatrolStep() {
        clearTimeout(patrolTimer);
        if (!gameActive) return;
        const delay = PATROL_MIN_MS + Math.random() * (PATROL_MAX_MS - PATROL_MIN_MS);
        patrolTimer = setTimeout(patrolStep, delay);
    }

    function patrolStep() {
        if (!gameActive || monsterState !== 'patrol') return;
        const options = PATROL_GRAPH[monsterNode];
        const next = options[Math.floor(Math.random() * options.length)];

        if (next.startsWith('ATTACK_')) {
            startAttack(next);
            return;
        }

        monsterNode = next;
        if (monsterNode !== 'banio') banioSoundPlayed = false;
        refreshCurrentCamera();
        scheduleNextPatrolStep();
    }

    function startAttack(type) {
        monsterState = type;
        refreshOfficeScene();
        updateHotspots();
        clearTimeout(attackTimer);
        attackTimer = setTimeout(() => {
            loseGame();
        }, ATTACK_TIMEOUT_MS);
    }

    function resolveAttack() {
        clearTimeout(attackTimer);
        monsterNode = 'comedor';
        monsterState = 'patrol';
        banioSoundPlayed = false;
        refreshOfficeScene();
        refreshCurrentCamera();
        updateHotspots();
        scheduleNextPatrolStep();
    }

    function closeWindow() {
        if (monsterState !== 'ATTACK_VENTANA' || currentScene !== 'LEFT') return;
        clearTimeout(attackTimer);
        ventanaClosing = true;
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

    ps5Hotspot.addEventListener('click', (e) => {
        e.stopPropagation();
        if (monsterState !== 'ATTACK_PUERTA' || !isMonitorUp || currentCamKey !== 'living') return;
        resolveAttack();
    });

    function updateHotspots() {
        const armarioActive = monsterState === 'ATTACK_ARMARIO' && currentScene === 'RIGHT' && !isMonitorUp;
        handArmario.classList.toggle('hidden', !armarioActive);

        const ps5Active = monsterState === 'ATTACK_PUERTA' && isMonitorUp && currentCamKey === 'living';
        ps5Hotspot.classList.toggle('hidden', !ps5Active);
    }

    // Imagen de cámara según si el monge está en esa sala o no
    function getCamImage(camKey) {
        const files = CAM_FILES[camKey];
        return monsterNode === camKey ? files.monge : files.alone;
    }

    function refreshCurrentCamera() {
        if (currentCamKey === 'banio') {
            camBg.classList.add('cam-banio-placeholder');
            camBg.style.backgroundImage = 'none';
            if (monsterNode === 'banio') playBanioSound();
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
        clearTimeout(patrolTimer);
        clearTimeout(attackTimer);
        if (isMonitorUp) {
            cameraSystem.classList.remove('active');
            isMonitorUp = false;
        }
        winScreen.classList.add('active');
        setTimeout(() => {
            winText.innerText = "6:00 AM";
        }, 2000);
    }

    function loseGame() {
        if (!gameActive) return;
        gameActive = false;
        clearInterval(timerInterval);
        clearTimeout(patrolTimer);
        clearTimeout(attackTimer);
        if (isMonitorUp) {
            cameraSystem.classList.remove('active');
            isMonitorUp = false;
        }
        loseScreen.classList.add('active');
    }

    // --- LÓGICA DEL MONITOR DE CÁMARAS ---
    monitorBar.addEventListener('mouseenter', () => {
        if (!gameActive || isTransitioning) return;

        isMonitorUp = !isMonitorUp;

        if (isMonitorUp) {
            cameraSystem.classList.add('active');
            document.body.classList.remove('can-click');
        } else {
            cameraSystem.classList.remove('active');
            // Re-evaluar zonas al bajar la cámara
            checkInteractionZones(targetX);
            refreshOfficeScene();
        }
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

            const camKey = e.target.getAttribute('data-cam');
            currentCamKey = camKey;
            if (camKey !== 'banio') banioSoundPlayed = false;

            setTimeout(() => {
                refreshCurrentCamera();
                currentX = window.innerWidth / 2;
                camBg.style.transform = `translateX(0px)`;
                camStaticFlash.classList.remove('flash');
                if (camKey === 'banio' && monsterNode === 'banio') playBanioSound();
                updateHotspots();
            }, 150); // Tiempo que dura el pantallazo blanco de estática
        });
    });


    // --- TRACKING DEL MOUSE (Actualizado) ---
    document.addEventListener('mousemove', (e) => {
        if (!gameActive || isTransitioning) return;
        targetX = e.clientX;
        targetY = e.clientY;

        if (!isMonitorUp) {
            checkInteractionZones(targetX);
        }
    });

    document.addEventListener('click', () => {
        if (!gameActive || isTransitioning || isMonitorUp) return;

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
    scheduleNextPatrolStep();
    animate();
});
