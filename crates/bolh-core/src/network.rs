use std::net::{TcpListener, TcpStream, SocketAddr};
use std::sync::{Arc, Mutex, OnceLock, atomic::{AtomicBool, Ordering}};
use std::thread::{self, JoinHandle};
use std::io::{Read, Write};

static NETWORK_STATE: OnceLock<NetworkState> = OnceLock::new();

struct NetworkState {
    peers: Arc<Mutex<Vec<String>>>,
    running: Arc<AtomicBool>,
    handle: Mutex<Option<JoinHandle<()>>>,
}

pub fn start(port: u16) -> Result<(), String> {
    let state = NETWORK_STATE.get_or_init(|| NetworkState {
        peers: Arc::new(Mutex::new(Vec::new())),
        running: Arc::new(AtomicBool::new(false)),
        handle: Mutex::new(None),
    });

    if state.running.load(Ordering::SeqCst) {
        return Err("already_running".into());
    }

    let peers = state.peers.clone();
    let running = state.running.clone();
    running.store(true, Ordering::SeqCst);

    let addr = format!("0.0.0.0:{}", port);
    let listener = TcpListener::bind(&addr).map_err(|e| format!("bind_failed:{}", e))?;
    listener.set_nonblocking(true).map_err(|e| format!("nb_mode_failed:{}", e))?;

    let handle = thread::spawn(move || {
        while running.load(Ordering::SeqCst) {
            match listener.accept() {
                Ok((mut stream, addr)) => {
                    let peer = addr.to_string();
                    if let Ok(mut p) = peers.lock() {
                        if !p.contains(&peer) { p.push(peer.clone()); }
                    }
                    // Minimal handshake: read up to 512 bytes then close
                    let mut buf = [0u8; 512];
                    let _ = stream.read(&mut buf);
                    let _ = stream.write_all(b"ok");
                }
                Err(ref e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                    // no incoming connection now
                    std::thread::sleep(std::time::Duration::from_millis(50));
                }
                Err(_) => {
                    std::thread::sleep(std::time::Duration::from_millis(50));
                }
            }
        }
    });

    *state.handle.lock().unwrap() = Some(handle);
    Ok(())
}

pub fn stop() -> Result<(), String> {
    let state = match NETWORK_STATE.get() {
        Some(s) => s,
        None => return Err("not_initialized".into()),
    };
    if !state.running.load(Ordering::SeqCst) {
        return Err("not_running".into());
    }
    state.running.store(false, Ordering::SeqCst);
    if let Some(h) = state.handle.lock().unwrap().take() {
        let _ = h.join();
    }
    // clear peers
    if let Ok(mut p) = state.peers.lock() {
        p.clear();
    }
    Ok(())
}

pub fn peers() -> Vec<String> {
    match NETWORK_STATE.get() {
        Some(s) => {
            if let Ok(p) = s.peers.lock() { p.clone() } else { Vec::new() }
        }
        None => Vec::new(),
    }
}
