use bolh_core::network;

#[test]
fn network_start_stop() {
    // start on ephemeral port (0)
    assert!(network::start(0).is_ok());
    // peers should be empty initially
    let peers = network::peers();
    assert!(peers.is_empty());
    assert!(network::stop().is_ok());
}
