import init, * as wasm from './pkg/zombie_game.js?v=d5d737a';

if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
}

function showBuildTimestamp(wasm) {
    const el = document.getElementById('build-version');
    if (typeof wasm.build_timestamp !== 'function') {
        if (el) el.textContent = 'Build: unknown';
        return;
    }
    const ts = Number(wasm.build_timestamp());
    if (!ts) {
        if (el) el.textContent = 'Build: unknown';
        return;
    }
    const text = `Build: ${new Date(ts * 1000).toLocaleString()}`;
    if (el) el.textContent = text;
    console.log(text);
}

async function run() {
    try {
        await init();
        showBuildTimestamp(wasm);
        console.log('Zombie RTS initialized successfully');

        // Expose test-harness functions on window (only present when built
        // with --features test-harness; harmless no-op otherwise)
        if (typeof wasm.test_set_camera === 'function') {
            window.test_set_camera = wasm.test_set_camera;
            window.test_advance_ticks = wasm.test_advance_ticks;
            window.test_load_level_json = wasm.test_load_level_json;
            window.test_disable_fog = wasm.test_disable_fog;
            window.test_set_terrain_color = wasm.test_set_terrain_color;
            window.test_set_facing = wasm.test_set_facing;
        }
    } catch (e) {
        console.error('Failed to initialize:', e);
    }
}

run();
