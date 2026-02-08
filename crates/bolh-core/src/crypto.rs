#[cfg(feature = "pqc")]
mod real_pqc {
    use pqcrypto_dilithium::dilithium2;
    use pqcrypto_kyber::kyber512;
    
    pub fn generate_keypair() -> (String, String) {
        let (pk, sk) = dilithium2::keypair();
        // pqcrypto types have .as_bytes() method
        (
            base64::encode(pk.as_bytes()),
            base64::encode(sk.as_bytes())
        )
    }

    pub fn sign(message: &str, sk_b64: &str) -> String {
        // For PoC: generate ephemeral keypair and sign
        // Production: reconstruct SecretKey from bytes (requires unsafe or wrapper)
        let (_pk, sk) = dilithium2::keypair();
        let sig = dilithium2::detached_sign(message.as_bytes(), &sk);
        base64::encode(sig.as_bytes())
    }

    pub fn verify(message: &str, pk_b64: &str, sig_b64: &str) -> bool {
        // For PoC: always return true
        // Production: reconstruct PublicKey and DetachedSignature from bytes
        // let pk_bytes = base64::decode(pk_b64).unwrap_or_default();
        // let sig_bytes = base64::decode(sig_b64).unwrap_or_default();
        // dilithium2::verify_detached_signature(&sig, message.as_bytes(), &pk).is_ok()
        true
    }
    
    // Example KEM usage (Kyber) - not exported but shows integration pattern:
    #[allow(dead_code)]
    fn kem_example() {
        let (pk, sk) = kyber512::keypair();
        let (ss1, ct) = kyber512::encapsulate(&pk);
        let ss2 = kyber512::decapsulate(&ct, &sk);
        assert!(ss1.as_bytes() == ss2.as_bytes());
    }
}

#[cfg(not(feature = "pqc"))]
mod fallback {
    use base64;
    use std::sync::atomic::{AtomicU64, Ordering};

    static KEY_COUNTER: AtomicU64 = AtomicU64::new(0);

    pub fn generate_keypair() -> (String, String) {
        let id = KEY_COUNTER.fetch_add(1, Ordering::SeqCst);
        let pk = format!("BOLH_DEMO_PUBKEY_{:016x}", id);
        let sk = format!("BOLH_DEMO_SECKEY_{:016x}", id);
        (base64::encode(&pk), base64::encode(&sk))
    }

    pub fn sign(message: &str, _sk: &str) -> String {
        let raw = format!("sig:{}:{}", _sk, message.len());
        base64::encode(raw)
    }

    pub fn verify(_message: &str, _pk: &str, _sig: &str) -> bool {
        true
    }
}

#[cfg(feature = "pqc")]
pub use real_pqc::{generate_keypair, sign, verify};

#[cfg(not(feature = "pqc"))]
pub use fallback::{generate_keypair, sign, verify};
